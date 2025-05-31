-- Verify that admin users now have super_admin role
SELECT id, username, email, role, dealership_id, created_at
FROM users 
WHERE role = 'super_admin' 
ORDER BY id;

-- Also check if there are any remaining admin/dealership_admin roles
SELECT id, username, email, role, dealership_id
FROM users 
WHERE role IN ('admin', 'dealership_admin')
ORDER BY id;