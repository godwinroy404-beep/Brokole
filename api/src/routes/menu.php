<?php
/** GET /menu — public. Only live items; inactive ones are invisible here. */
function route_menu(PDO $db, Guard $guard): never
{
    // Staff with menu.read may see everything, including retired items.
    $seeAll = $guard->can('menu.read');

    $sql = 'SELECT mi.id, mi.slug, mi.name, mi.description, mi.price, mi.image_url,
                   mi.prep_time, mi.tags, mi.is_popular, mi.is_active, COALESCE(mi.is_available, 1) AS is_available, mi.sort_order,
                   c.slug AS category_slug, c.name AS category_name,
                   n.calories, n.protein_g, n.carbs_g, n.fat_g, n.fiber_g
              FROM menu_items mi
         LEFT JOIN categories c ON c.id = mi.category_id
         LEFT JOIN menu_item_nutrition n ON n.menu_item_id = mi.id
             WHERE mi.deleted_at IS NULL';

    if (!$seeAll) $sql .= ' AND mi.is_active = 1';
    $sql .= ' ORDER BY mi.sort_order, mi.name';

    Json::ok(['items' => $db->query($sql)->fetchAll()]);
}

/** GET /categories — public. */
function route_categories(PDO $db): never
{
    $rows = $db->query(
        'SELECT id, slug, name FROM categories
          WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order'
    )->fetchAll();
    Json::ok(['categories' => $rows]);
}

/** PATCH /admin/menu/{id} — requires menu.write. */
function route_menu_update(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->requirePermission('menu.write');
    $b = Json::body();

    $st = $db->prepare('SELECT * FROM menu_items WHERE id = ? AND deleted_at IS NULL');
    $st->execute([$id]);
    $before = $st->fetch();
    if (!$before) Json::error('Menu item not found', 404);

    // Allowlist: only these columns can ever be written from a request
    $allowed = ['name', 'slug', 'category_id', 'description', 'price', 'image_url', 'prep_time', 'is_popular', 'is_active', 'is_available', 'sort_order'];
    $sets = [];
    $args = [];

    foreach ($allowed as $col) {
        if (!array_key_exists($col, $b)) continue;
        if ($col === 'price') {
            $price = (float) $b[$col];
            if ($price < 0) Json::error('Price cannot be negative', 422);
            $sets[] = 'price = ?'; $args[] = number_format($price, 2, '.', '');
        } elseif (in_array($col, ['is_popular', 'is_active', 'is_available'], true)) {
            $sets[] = "$col = ?"; $args[] = $b[$col] ? 1 : 0;
        } elseif ($col === 'sort_order') {
            $sets[] = 'sort_order = ?'; $args[] = (int) $b[$col];
        } elseif ($col === 'category_id') {
            $sets[] = 'category_id = ?'; $args[] = !empty($b[$col]) ? (string) $b[$col] : null;
        } else {
            $sets[] = "$col = ?"; $args[] = (string) $b[$col];
        }
    }

    if ($sets) {
        $args[] = $id;
        $db->prepare('UPDATE menu_items SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);
    }

    // Update menu_item_nutrition if provided
    if (array_key_exists('calories', $b) || array_key_exists('protein_g', $b) || array_key_exists('carbs_g', $b) || array_key_exists('fat_g', $b) || array_key_exists('fiber_g', $b)) {
        $calories = max(0, (float) ($b['calories'] ?? 0));
        $protein_g = max(0, (float) ($b['protein_g'] ?? 0));
        $carbs_g = max(0, (float) ($b['carbs_g'] ?? 0));
        $fat_g = max(0, (float) ($b['fat_g'] ?? 0));
        $fiber_g = max(0, (float) ($b['fiber_g'] ?? 0));

        $db->prepare(
            'INSERT INTO menu_item_nutrition (menu_item_id, calories, protein_g, carbs_g, fat_g, fiber_g)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE calories = VALUES(calories), protein_g = VALUES(protein_g), carbs_g = VALUES(carbs_g), fat_g = VALUES(fat_g), fiber_g = VALUES(fiber_g)'
        )->execute([$id, $calories, $protein_g, $carbs_g, $fat_g, $fiber_g]);
    }

    $stItem = $db->prepare(
        'SELECT mi.id, mi.slug, mi.name, mi.description, mi.price, mi.image_url,
                mi.prep_time, mi.is_popular, mi.is_active, COALESCE(mi.is_available, 1) AS is_available, mi.sort_order,
                c.name AS category_name,
                n.calories, n.protein_g, n.carbs_g, n.fat_g, n.fiber_g
           FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      LEFT JOIN menu_item_nutrition n ON n.menu_item_id = mi.id
          WHERE mi.id = ?'
    );
    $stItem->execute([$id]);
    $after = $stItem->fetch();

    Audit::log($db, $user, 'menu_items', $id, 'UPDATE', $before, $after);

    Json::ok(['item' => $after]);
}

/** DELETE /admin/menu/{id} — soft delete a menu item. Requires menu.write. */
function route_menu_delete(PDO $db, Guard $guard, string $id): never
{
    $user = $guard->requirePermission('menu.write');

    $st = $db->prepare('SELECT * FROM menu_items WHERE id = ? AND deleted_at IS NULL');
    $st->execute([$id]);
    $before = $st->fetch();
    if (!$before) Json::error('Menu item not found', 404);

    $db->prepare('UPDATE menu_items SET deleted_at = NOW(), is_active = 0 WHERE id = ?')->execute([$id]);

    Audit::log($db, $user, 'menu_items', $id, 'DELETE', $before, null);

    Json::ok(['deleted' => true, 'id' => $id]);
}

/** POST /admin/menu — create a new menu item. Requires menu.write. */
function route_menu_create(PDO $db, Guard $guard): never
{
    $user = $guard->requirePermission('menu.write');
    $b = Json::body();

    $name = trim((string) ($b['name'] ?? ''));
    $price = (float) ($b['price'] ?? 0);

    if ($name === '') Json::error('Menu item name is required', 422);
    if ($price < 0) Json::error('Price cannot be negative', 422);

    $rawSlug = trim((string) ($b['slug'] ?? ''));
    if ($rawSlug === '') {
        $rawSlug = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $name));
        $rawSlug = trim($rawSlug, '-');
    }
    if ($rawSlug === '') $rawSlug = 'item-' . substr(md5($name . microtime()), 0, 6);

    // Ensure unique slug
    $st = $db->prepare('SELECT id FROM menu_items WHERE slug = ? AND deleted_at IS NULL');
    $st->execute([$rawSlug]);
    if ($st->fetch()) {
        $rawSlug .= '-' . substr(md5(microtime()), 0, 4);
    }

    $id = Db::uuid();
    $categoryId = isset($b['category_id']) && (string) $b['category_id'] !== '' ? (string) $b['category_id'] : null;
    $description = isset($b['description']) ? trim((string) $b['description']) : null;
    $imageUrl = isset($b['image_url']) ? trim((string) $b['image_url']) : null;
    $prepTime = isset($b['prep_time']) ? trim((string) $b['prep_time']) : null;
    $isPopular = !empty($b['is_popular']) ? 1 : 0;
    $isActive = isset($b['is_active']) ? ($b['is_active'] ? 1 : 0) : 1;
    $isAvailable = isset($b['is_available']) ? ($b['is_available'] ? 1 : 0) : 1;
    $sortOrder = isset($b['sort_order']) ? (int) $b['sort_order'] : 0;

    $db->prepare(
        'INSERT INTO menu_items (id, category_id, slug, name, description, price, image_url, prep_time, is_popular, is_active, is_available, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $categoryId, $rawSlug, $name, $description,
        number_format($price, 2, '.', ''), $imageUrl, $prepTime,
        $isPopular, $isActive, $isAvailable, $sortOrder, $user['id']
    ]);

    // Optional nutrition values
    $calories = max(0, (float) ($b['calories'] ?? 0));
    $protein_g = max(0, (float) ($b['protein_g'] ?? 0));
    $carbs_g = max(0, (float) ($b['carbs_g'] ?? 0));
    $fat_g = max(0, (float) ($b['fat_g'] ?? 0));
    $fiber_g = max(0, (float) ($b['fiber_g'] ?? 0));

    if ($calories > 0 || $protein_g > 0 || $carbs_g > 0 || $fat_g > 0 || $fiber_g > 0) {
        $db->prepare(
            'INSERT INTO menu_item_nutrition (menu_item_id, calories, protein_g, carbs_g, fat_g, fiber_g)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE calories = VALUES(calories), protein_g = VALUES(protein_g), carbs_g = VALUES(carbs_g), fat_g = VALUES(fat_g), fiber_g = VALUES(fiber_g)'
        )->execute([$id, $calories, $protein_g, $carbs_g, $fat_g, $fiber_g]);
    }

    $stItem = $db->prepare(
        'SELECT mi.id, mi.slug, mi.name, mi.description, mi.price, mi.image_url,
                mi.prep_time, mi.is_popular, mi.is_active, COALESCE(mi.is_available, 1) AS is_available, mi.sort_order,
                c.name AS category_name,
                n.calories, n.protein_g, n.carbs_g, n.fat_g, n.fiber_g
           FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      LEFT JOIN menu_item_nutrition n ON n.menu_item_id = mi.id
          WHERE mi.id = ?'
    );
    $stItem->execute([$id]);
    $item = $stItem->fetch();

    Audit::log($db, $user, 'menu_items', $id, 'INSERT', null, $item);

    Json::ok(['item' => $item], 201);
}

