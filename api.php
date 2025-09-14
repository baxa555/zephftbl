<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

$customersFile = 'customers.json';
$adminLogsFile = 'admin-logs.json';

// Initialize files if they don't exist
if (!file_exists($customersFile)) {
    file_put_contents($customersFile, '[]');
}
if (!file_exists($adminLogsFile)) {
    file_put_contents($adminLogsFile, '[]');
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $action = isset($_GET['action']) ? $_GET['action'] : '';

    switch ($method) {
        case 'GET':
            handleGet($action, $customersFile, $adminLogsFile);
            break;
        case 'POST':
            handlePost($action, $customersFile, $adminLogsFile);
            break;
        case 'DELETE':
            handleDelete($action, $customersFile, $adminLogsFile);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}

function handleGet($action, $customersFile, $adminLogsFile) {
    try {
        switch ($action) {
            case 'customers':
                if (!file_exists($customersFile)) {
                    echo json_encode([]);
                    return;
                }
                
                $content = file_get_contents($customersFile);
                $customers = json_decode($content, true);
                if ($customers === null) {
                    $customers = [];
                }
            // Update remaining days and status for each customer
            foreach ($customers as &$customer) {
                if ($customer['type'] !== 'sınırsız' && isset($customer['endDate'])) {
                    $endDate = new DateTime($customer['endDate']);
                    $today = new DateTime();
                    $interval = $today->diff($endDate);
                    $remainingDays = $interval->invert ? -$interval->days : $interval->days;
                    
                    $customer['remainingDays'] = $remainingDays;
                    
                    if ($remainingDays <= 0) {
                        $customer['status'] = 'expired';
                    } elseif ($remainingDays <= 7) {
                        $customer['status'] = 'expiring';
                    } else {
                        $customer['status'] = 'active';
                    }
                } else {
                    $customer['remainingDays'] = null;
                    $customer['status'] = 'active';
                }
            }
            echo json_encode($customers);
            break;
        case 'admin-logs':
            $logs = json_decode(file_get_contents($adminLogsFile), true);
            if ($logs === null) {
                $logs = [];
            }
            echo json_encode($logs);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Get error: ' . $e->getMessage()]);
    }
}

function handlePost($action, $customersFile, $adminLogsFile) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON input']);
            return;
        }
    
    switch ($action) {
        case 'add-customer':
            $customers = json_decode(file_get_contents($customersFile), true);
            if ($customers === null) {
                $customers = [];
            }
            
            // Calculate revenue
            $packages = [
                'GS Premium' => 299,
                'FB Premium' => 299,
                'BJK Premium' => 299,
                'Premium' => 199
            ];
            
            $multipliers = [
                'sınırsız' => 12,
                'sezonluk' => 6,
                '1 aylık' => 1
            ];
            
            $customer = $input;
            $customer['revenue'] = ($packages[$customer['package']] ?? 199) * ($multipliers[$customer['type']] ?? 1);
            
            // Calculate end date
            if ($customer['type'] === 'sınırsız') {
                $customer['endDate'] = null;
                $customer['remainingDays'] = null;
                $customer['status'] = 'active';
            } else {
                $purchaseDate = DateTime::createFromFormat('d.m.y', $customer['purchaseDate']);
                if ($customer['type'] === 'sezonluk') {
                    $endDate = new DateTime($purchaseDate->format('Y') . '-06-30');
                    if ($purchaseDate->format('m') >= 7) {
                        $endDate->modify('+1 year');
                    }
                } else { // 1 aylık
                    $endDate = clone $purchaseDate;
                    $endDate->modify('+1 month');
                }
                
                $customer['endDate'] = $endDate->format('Y-m-d');
                
                $today = new DateTime();
                $interval = $today->diff($endDate);
                $remainingDays = $interval->invert ? -$interval->days : $interval->days;
                $customer['remainingDays'] = $remainingDays;
                
                if ($remainingDays <= 0) {
                    $customer['status'] = 'expired';
                } elseif ($remainingDays <= 7) {
                    $customer['status'] = 'expiring';
                } else {
                    $customer['status'] = 'active';
                }
            }
            
            $customers[] = $customer;
            
            if (file_put_contents($customersFile, json_encode($customers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                echo json_encode(['success' => true, 'customer' => $customer]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to save customer']);
            }
            break;
            
        case 'add-log':
            $logs = json_decode(file_get_contents($adminLogsFile), true);
            if ($logs === null) {
                $logs = [];
            }
            
            $log = $input;
            $log['id'] = time() . rand(1000, 9999);
            $log['date'] = date('c'); // ISO 8601 format
            
            $logs[] = $log;
            
            if (file_put_contents($adminLogsFile, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                echo json_encode(['success' => true, 'log' => $log]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to save log']);
            }
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Post error: ' . $e->getMessage()]);
    }
}

function handleDelete($action, $customersFile, $adminLogsFile) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($input === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON input']);
            return;
        }
    
    switch ($action) {
        case 'delete-customer':
            $customers = json_decode(file_get_contents($customersFile), true);
            if ($customers === null) {
                $customers = [];
            }
            
            $customerName = $input['name'];
            $customers = array_filter($customers, function($customer) use ($customerName) {
                return $customer['name'] !== $customerName;
            });
            
            // Reindex array
            $customers = array_values($customers);
            
            if (file_put_contents($customersFile, json_encode($customers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to delete customer']);
            }
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Delete error: ' . $e->getMessage()]);
    }
}
?>