const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function initializeDatabase() {
  console.log('🚀 Initializing database...\n');

  try {
    // Test connection
    console.log('1. Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful\n');

    // Read schema file
    console.log('2. Reading schema file...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✓ Schema file loaded\n');

    // Execute schema
    console.log('3. Creating tables...');
    await pool.query(schema);
    console.log('✓ Tables created successfully\n');

    // Verify tables
    console.log('4. Verifying tables...');
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('✓ Found tables:');
    result.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('\n🎉 Database initialization complete!');
    console.log('\nYou can now start the server with: npm run dev');

  } catch (error) {
    console.error('\n❌ Database initialization failed:');
    console.error(error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tips:');
      console.error('  - Check that your database is running');
      console.error('  - Verify DB_HOST and DB_PORT in .env');
      console.error('  - For Railway, make sure you have the correct TCP proxy domain/port');
    } else if (error.code === '42P07') {
      console.error('\n💡 Tables already exist. This is normal if you\'ve run this before.');
      console.error('   To reset the database, drop all tables first.');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
