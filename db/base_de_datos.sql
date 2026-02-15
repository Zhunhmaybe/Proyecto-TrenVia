-- Script de creación de base de datos para sistema de tickets de tren (PostgreSQL)

-- Nota: En PostgreSQL, la base de datos se crea fuera del script SQL si se ejecuta conectado a ella.
-- Asumimos que la base de datos 'Tren' ya existe o se crea manualmente.

-- Si se necesita reiniciar el esquema:
DROP TABLE IF EXISTS pagos CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS rutas CASCADE;
DROP TABLE IF EXISTS estaciones CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- Tabla de Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('admin', 'pasajero', 'cliente')) DEFAULT 'cliente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Estaciones
CREATE TABLE estaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de Rutas
CREATE TABLE rutas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    estacion_origen_id INT REFERENCES estaciones(id),
    estacion_destino_id INT REFERENCES estaciones(id),
    precio DECIMAL(10, 2) NOT NULL
);

-- Tabla de Tickets
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    ruta_id INT REFERENCES rutas(id),
    codigo_qr TEXT NOT NULL,
    estado VARCHAR(20) CHECK (estado IN ('pagado', 'usado', 'cancelado')) DEFAULT 'pagado',
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pagos
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    ticket_id INT REFERENCES tickets(id),
    monto DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(20) CHECK (metodo_pago IN ('credito', 'debito', 'transferencia')) NOT NULL,
    referencia VARCHAR(100),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos de Prueba

-- Usuarios (password: '123456' hasheado - simulado)
INSERT INTO usuarios (nombre, email, password, rol) VALUES 
('Admin Metro', 'admin@metroquito.gob.ec', '$2a$10$wI6.j.X.y.z.1.2.3.4.5.6.7.8.9.0', 'admin'),
('Juan Perez', 'juan@example.com', '$2a$10$wI6.j.X.y.z.1.2.3.4.5.6.7.8.9.0', 'pasajero');

-- Estaciones
INSERT INTO estaciones (nombre, direccion) VALUES 
('Quitumbe', 'Av. Cóndor Ñan y Av. Mariscal Sucre'),
('Morán Valverde', 'Av. Rumichaca Ñan y Av. Morán Valverde'),
('Solanda', 'Av. Ajaví y Av. Rumichaca Ñan'),
('El Recreo', 'Av. Maldonado y Av. El Recreo'),
('Magdalena', 'Av. Rodrigo de Chávez y Av. 5 de Junio'),
('San Francisco', 'Plaza de San Francisco'),
('Alameda', 'Parque La Alameda'),
('El Labrador', 'Av. Amazonas y Av. Isaac Albéniz');

-- Rutas
INSERT INTO rutas (nombre, estacion_origen_id, estacion_destino_id, precio) VALUES 
('Ruta Sur-Norte', 1, 8, 0.45),
('Ruta Norte-Sur', 8, 1, 0.45),
('Ruta Centro-Norte', 6, 8, 0.45);
