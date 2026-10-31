<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$root = __DIR__;
$files = array_merge(
    glob($root . '/*.html') ?: array(),
    glob($root . '/*.css') ?: array(),
    glob($root . '/*.js') ?: array(),
    glob($root . '/*.php') ?: array()
);

foreach (array('css', 'js') as $directory) {
    $path = $root . DIRECTORY_SEPARATOR . $directory;
    if (!is_dir($path)) {
        continue;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->isFile() && preg_match('/\.(html|css|js|php)$/i', $file->getFilename())) {
            $files[] = $file->getPathname();
        }
    }
}

sort($files);
$context = hash_init('sha256');
foreach (array_unique($files) as $file) {
    $contentHash = hash_file('sha256', $file);
    if ($contentHash === false) {
        http_response_code(500);
        echo json_encode(array('error' => 'Could not read a project file.'));
        exit;
    }
    hash_update($context, $file . ':' . $contentHash . "\n");
}

echo json_encode(array('hash' => hash_final($context)));
