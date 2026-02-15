const fs = require('fs');
const path = require('path');
const db = require('../config/base_de_datos');

const seedDatabase = async () => {
    try {
        const sqlPath = path.join(__dirname, 'base_de_datos.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Ejecutando script de base de datos...');
        await db.query(sql);
        console.log('Base de datos inicializada correctamente.');
        process.exit(0);
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
        process.exit(1);
    }
};

seedDatabase();
