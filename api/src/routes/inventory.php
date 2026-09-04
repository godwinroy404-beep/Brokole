<?php
/**
 * Inventory.
 *
 * On-hand quantity is never stored — it is SUM(stock_movements.quantity). Every
 * change is a new row, so "why is there 3.5kg of paneer" always has an answer.
 *
 * Sign convention, enforced here rather than trusted from the client:
 *   receipt    +  goods arriving
 *   adjustment ±  a count correction, either direction
 *   issue      -  consumed by the kitchen
 *   wastage    -  spoiled, dropped, expired
 */

const MOVEMENT_KINDS = ['receipt', 'issue', 'wastage', 'adjustment'];

/** GET /admin/inventory */
function route_list_inventory(PDO $db, Guard $guard): never
{
    $guard->requirePermission('inventory.read');

    $rows = $db->query(
        "SELECT i.id, i.sku, i.name, i.category, i.unit, i.min_threshold,
                i.cost_per_unit, i.supplier, i.is_active,
                COALESCE(s.on_hand, 0)  AS on_hand,
                s.last_restocked,
                COALESCE(s.wasted_total, 0) AS wasted_total,
                (COALESCE(s.on_hand, 0) <= i.min_threshold) AS is_low
           FROM ingredients i
      LEFT JOIN stock_on_hand s ON s.ingredient_id = i.id
          WHERE i.deleted_at IS NULL
       ORDER BY (COALESCE(s.on_hand,0) <= i.min_threshold) DESC, i.category, i.name"
    )->fetchAll();

    $lowCount = 0;
    $stockValue = 0.0;
    foreach ($rows as $r) {
        if ((int) $r['is_low'] === 1) $lowCount++;
        $stockValue += (float) $r['on_hand'] * (float) $r['cost_per_unit'];
    }

    Json::ok([
        'items' => $rows,
        'summary' => [
            'items_total'  => count($rows),
            'items_low'    => $lowCount,
            'stock_value'  => round($stockValue, 2),
        ],
    ]);
}

/** POST /admin/inventory — add an ingredient to the shelf. */
function route_create_ingredient(PDO $db, Guard $guard): never
{
    $user = $guard->requirePermission('inventory.write');
    $b = Json::body();

    $sku  = strtoupper(trim((string) ($b['sku'] ?? '')));
    $name = trim((string) ($b['name'] ?? ''));

    if ($sku === '' || $name === '') Json::error('SKU and name are required', 422);
    if (!preg_match('/^[A-Z0-9][A-Z0-9\-_]{1,47}$/', $sku)) {
        Json::error('SKU may contain letters, numbers, hyphens and underscores only', 422);
    }

    $st = $db->prepare('SELECT id FROM ingredients WHERE sku = ?');
    $st->execute([$sku]);
    if ($st->fetch()) Json::error('That SKU already exists', 409);

    $id = Db::uuid();
    $db->prepare(
        'INSERT INTO ingredients (id, sku, name, category, unit, min_threshold, cost_per_unit, supplier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $sku, $name,
        trim((string) ($b['category'] ?? 'Uncategorised')) ?: 'Uncategorised',
        trim((string) ($b['unit'] ?? 'kg')) ?: 'kg',
        max(0, (float) ($b['min_threshold'] ?? 0)),
        max(0, (float) ($b['cost_per_unit'] ?? 0)),
        trim((string) ($b['supplier'] ?? '')) ?: null,
    ]);

    // Opening stock, if given, is recorded as a receipt like any other.
    $opening = (float) ($b['opening_quantity'] ?? 0);
    if ($opening > 0) {
        $db->prepare(
            'INSERT INTO stock_movements (id, ingredient_id, kind, quantity, unit_cost, reason, actor_id)
             VALUES (?, ?, "receipt", ?, ?, "Opening balance", ?)'
        )->execute([Db::uuid(), $id, $opening, (float) ($b['cost_per_unit'] ?? 0), $user['id']]);
    }

    Audit::log($db, $user, 'ingredients', $id, 'INSERT', null, ['sku' => $sku, 'name' => $name]);
    Json::ok(['id' => $id, 'sku' => $sku], 201);
}

/** PATCH /admin/inventory/{id} — edit the item, never its quantity. */
function route_update_ingredient(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->requirePermission('inventory.write');
    $b = Json::body();

    $st = $db->prepare('SELECT * FROM ingredients WHERE id = ? AND deleted_at IS NULL');
    $st->execute([$id]);
    $before = $st->fetch();
    if (!$before) Json::error('Ingredient not found', 404);

    // Quantity is deliberately NOT in this list. Stock changes only through a
    // movement, so the ledger and the on-hand figure can never disagree.
    $sets = [];
    $args = [];
    foreach (['name', 'category', 'unit', 'supplier'] as $col) {
        if (array_key_exists($col, $b)) { $sets[] = "$col = ?"; $args[] = trim((string) $b[$col]); }
    }
    foreach (['min_threshold', 'cost_per_unit'] as $col) {
        if (array_key_exists($col, $b)) { $sets[] = "$col = ?"; $args[] = max(0, (float) $b[$col]); }
    }
    if (array_key_exists('is_active', $b)) { $sets[] = 'is_active = ?'; $args[] = $b['is_active'] ? 1 : 0; }

    if (!$sets) Json::error('Nothing to update', 422);

    $args[] = $id;
    $db->prepare('UPDATE ingredients SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);

    $st->execute([$id]);
    Audit::log($db, $user, 'ingredients', $id, 'UPDATE', $before, $st->fetch());
    Json::ok(['id' => $id]);
}

/** POST /admin/inventory/{id}/movements — the only way stock changes. */
function route_create_movement(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->requirePermission('inventory.write');
    $b = Json::body();

    $kind = strtolower(trim((string) ($b['kind'] ?? '')));
    if (!in_array($kind, MOVEMENT_KINDS, true)) {
        Json::error('kind must be one of: ' . implode(', ', MOVEMENT_KINDS), 422);
    }

    $qty = (float) ($b['quantity'] ?? 0);
    if ($qty == 0.0) Json::error('quantity must not be zero', 422);
    if (abs($qty) > 100000) Json::error('That quantity looks wrong', 422);

    $st = $db->prepare('SELECT id, name, unit FROM ingredients WHERE id = ? AND deleted_at IS NULL');
    $st->execute([$id]);
    $item = $st->fetch();
    if (!$item) Json::error('Ingredient not found', 404);

    // The API decides the sign. A client sending -5 for a receipt, or +5 for
    // wastage, cannot quietly invert the meaning of the ledger.
    $signed = match ($kind) {
        'receipt'    => abs($qty),
        'issue', 'wastage' => -abs($qty),
        'adjustment' => $qty,          // corrections legitimately go either way
    };

    $onHand = (float) $db->query(
        'SELECT COALESCE(SUM(quantity), 0) FROM stock_movements WHERE ingredient_id = ' . $db->quote($id)
    )->fetchColumn();

    if ($signed < 0 && $onHand + $signed < 0) {
        Json::error(
            sprintf('Only %.3f %s of %s left — cannot take out %.3f',
                    $onHand, $item['unit'], $item['name'], abs($signed)),
            422
        );
    }

    $movementId = Db::uuid();
    $db->prepare(
        'INSERT INTO stock_movements (id, ingredient_id, kind, quantity, unit_cost, reason, reference, actor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $movementId, $id, $kind, $signed,
        isset($b['unit_cost']) ? max(0, (float) $b['unit_cost']) : null,
        isset($b['reason']) ? mb_substr((string) $b['reason'], 0, 255) : null,
        isset($b['reference']) ? mb_substr((string) $b['reference'], 0, 64) : null,
        $user['id'],
    ]);

    Audit::log($db, $user, 'stock_movements', $movementId, strtoupper($kind), null,
               ['ingredient' => $item['name'], 'quantity' => $signed]);

    Json::ok(['id' => $movementId, 'kind' => $kind, 'quantity' => $signed,
              'on_hand' => round($onHand + $signed, 3)], 201);
}

/** GET /admin/inventory/{id}/movements — the ledger for one item. */
function route_list_movements(PDO $db, Guard $guard, string $id): never
{
    $guard->requirePermission('inventory.read');

    $st = $db->prepare(
        'SELECT m.id, m.kind, m.quantity, m.unit_cost, m.reason, m.reference, m.occurred_at,
                u.full_name AS actor_name
           FROM stock_movements m
      LEFT JOIN users u ON u.id = m.actor_id
          WHERE m.ingredient_id = ?
       ORDER BY m.occurred_at DESC, m.id DESC
          LIMIT 200'
    );
    $st->execute([$id]);
    Json::ok(['movements' => $st->fetchAll()]);
}

/** DELETE /admin/inventory/{id} — soft delete an ingredient. */
function route_delete_ingredient(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->requirePermission('inventory.write');

    $st = $db->prepare('SELECT * FROM ingredients WHERE id = ? AND deleted_at IS NULL');
    $st->execute([$id]);
    $before = $st->fetch();
    if (!$before) Json::error('Ingredient not found', 404);

    $db->prepare('UPDATE ingredients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$id]);

    Audit::log($db, $user, 'ingredients', $id, 'DELETE', $before, null);
    Json::ok(['id' => $id, 'deleted' => true]);
}
