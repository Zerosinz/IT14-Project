// MySQL connection, table creation (based on the proposal's ERD) and starter data.
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cfg = { host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '' };
const NAME = process.env.DB_NAME || 'roderos_water';
let pool;

const DDL = [
`CREATE TABLE IF NOT EXISTS employees(employee_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(120) NOT NULL, contact_number VARCHAR(20), job_title VARCHAR(60), employment_status VARCHAR(20) DEFAULT 'Active')`,
`CREATE TABLE IF NOT EXISTS users(user_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, username VARCHAR(50) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(30) NOT NULL, account_status VARCHAR(20) DEFAULT 'Active', employee_id INT NULL, FOREIGN KEY(employee_id) REFERENCES employees(employee_id))`,
`CREATE TABLE IF NOT EXISTS customers(customer_id INT AUTO_INCREMENT PRIMARY KEY, customer_name VARCHAR(120) NOT NULL, contact_number VARCHAR(20), address TEXT, notes TEXT, date_added DATETIME DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS products(product_id INT AUTO_INCREMENT PRIMARY KEY, product_name VARCHAR(100) NOT NULL, size_or_type VARCHAR(50), unit_price DECIMAL(10,2) NOT NULL, status VARCHAR(20) DEFAULT 'Active')`,
`CREATE TABLE IF NOT EXISTS orders(order_id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, created_by INT, order_date DATETIME DEFAULT CURRENT_TIMESTAMP, order_channel VARCHAR(20), delivery_required BOOLEAN DEFAULT 0, delivery_address TEXT, order_status VARCHAR(25) DEFAULT 'Pending', notes TEXT, FOREIGN KEY(customer_id) REFERENCES customers(customer_id), FOREIGN KEY(created_by) REFERENCES users(user_id))`,
`CREATE TABLE IF NOT EXISTS order_items(order_item_id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(10,2) NOT NULL, line_total DECIMAL(10,2) NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(product_id))`,
`CREATE TABLE IF NOT EXISTS deliveries(delivery_id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL UNIQUE, assigned_employee_id INT NULL, scheduled_at DATETIME, delivered_at DATETIME NULL, delivery_status VARCHAR(25) DEFAULT 'Scheduled', remarks TEXT, FOREIGN KEY(order_id) REFERENCES orders(order_id), FOREIGN KEY(assigned_employee_id) REFERENCES employees(employee_id))`,
`CREATE TABLE IF NOT EXISTS sales(sale_id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NULL UNIQUE, recorded_by INT, sale_date DATETIME DEFAULT CURRENT_TIMESTAMP, total_amount DECIMAL(10,2) NOT NULL, payment_status VARCHAR(20) DEFAULT 'Unpaid', payment_method VARCHAR(30), FOREIGN KEY(order_id) REFERENCES orders(order_id), FOREIGN KEY(recorded_by) REFERENCES users(user_id))`,
`CREATE TABLE IF NOT EXISTS gallon_transactions(gallon_txn_id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, related_order_id INT NULL, recorded_by INT, transaction_type VARCHAR(10) NOT NULL, quantity INT NOT NULL, transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP, remarks TEXT, FOREIGN KEY(customer_id) REFERENCES customers(customer_id), FOREIGN KEY(recorded_by) REFERENCES users(user_id))`,
`CREATE TABLE IF NOT EXISTS complaints(complaint_id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, related_order_id INT NULL, handled_by INT, received_at DATETIME DEFAULT CURRENT_TIMESTAMP, category VARCHAR(60), description TEXT, resolution TEXT, status VARCHAR(20) DEFAULT 'Open', resolved_at DATETIME NULL, FOREIGN KEY(customer_id) REFERENCES customers(customer_id), FOREIGN KEY(handled_by) REFERENCES users(user_id))`,
`CREATE TABLE IF NOT EXISTS expenses(expense_id INT AUTO_INCREMENT PRIMARY KEY, recorded_by INT, expense_date DATE NOT NULL, category VARCHAR(60), description TEXT, amount DECIMAL(10,2) NOT NULL, FOREIGN KEY(recorded_by) REFERENCES users(user_id))`,
`CREATE TABLE IF NOT EXISTS salary_records(salary_record_id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, recorded_by INT, pay_period_start DATE, pay_period_end DATE, gross_salary DECIMAL(10,2) NOT NULL, deductions DECIMAL(10,2) DEFAULT 0, net_salary DECIMAL(10,2), date_paid DATE NULL, payment_status VARCHAR(20) DEFAULT 'Pending', FOREIGN KEY(employee_id) REFERENCES employees(employee_id), FOREIGN KEY(recorded_by) REFERENCES users(user_id))`,
`CREATE TABLE IF NOT EXISTS chat_messages(id INT AUTO_INCREMENT PRIMARY KEY, session_id VARCHAR(40) NOT NULL, customer_name VARCHAR(60), sender VARCHAR(10) NOT NULL, message VARCHAR(500) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX(session_id))`
];

async function init() {
  const c = await mysql.createConnection(cfg);
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${NAME}\``);
  await c.end();
  pool = mysql.createPool({ ...cfg, database: NAME, dateStrings: true, connectionLimit: 10 });
  for (const sql of DDL) await pool.query(sql);
  if (!(await q('SELECT 1 FROM users LIMIT 1')).length) {
    const pw = process.env.ADMIN_PASSWORD || 'admin123';
    await q('INSERT INTO users SET ?', [{ full_name: 'Sophie Roderos', username: 'owner', password_hash: bcrypt.hashSync(pw, 10), role: 'Owner/Admin' }]);
    console.log(`First login -> username: owner  password: ${pw}  (change it in User Management)`);
  }
  if (!(await q('SELECT 1 FROM products LIMIT 1')).length)
    await q('INSERT INTO products(product_name,size_or_type,unit_price) VALUES ?', [[
      ['Purified Water Refill', '5-gallon', 25], ['Purified Water Refill', '3-gallon', 15]]]); // sample prices: confirm with the client
}

const q = (sql, p) => pool.query(sql, p).then(r => r[0]);
module.exports = { init, q };
