require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const multer = require("multer");
const sharp = require("sharp");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname)));

const BASE_URL =
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);

// ==========================
// DOCUMENTOS CONDUCTOR
// ==========================
const storageDocumentos =
    multer.diskStorage({
        destination: (req, file, cb) => {
            cb(
                null,
                "uploads/documentos"
            );
        },
        filename: (req, file, cb) => {
            cb(
                null,
                `doc_${Date.now()}_${file.originalname}`
            );
        }
    });

const uploadDocumentos =
    multer({
        storage: storageDocumentos
    });

// ==========================
// DOCUMENTOS TRACTO
// ==========================
const storageDocumentosTracto =
    multer.diskStorage({
        destination: (req, file, cb) => {
            cb(
                null,
                "uploads/documentos_tracto"
            );
        },
        filename: (req, file, cb) => {
            cb(
                null,
                `tracto_${Date.now()}_${file.originalname}`
            );
        }
    });

const uploadDocumentosTracto =
    multer({
        storage: storageDocumentosTracto
    });



// ==========================
// DOCUMENTOS carretera
// ==========================

const storageDocumentosCarreta =
    multer.diskStorage({

        destination:
            (req, file, cb) => {

                cb(
                    null,
                    'uploads/documentos_carreta'
                );
            },

        filename:
            (req, file, cb) => {

                cb(
                    null,
                    `carreta_${Date.now()}_${file.originalname}`
                );
            }
    });

const uploadDocumentosCarreta =
    multer({
        storage:
            storageDocumentosCarreta
    });
// ==========================
// SUBIDA FOTO TRACTO
// ==========================
const storageTractos =
    multer.memoryStorage();

const uploadTractos =
    multer({
        storage: storageTractos
    });
// ==========================
// CONEXIÓN POSTGRES
// ==========================
const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================
// INDEX
// ==========================
app.get("/", (req, res) => {
    res.sendFile(
        path.resolve(
            __dirname,
            "index.html"
        )
    );
});

app.post("/api/login", async (req, res) => {
    try {
        const { correo, password } = req.body;

        const query = `
            SELECT nombre, correo, rol
            FROM usuario
            WHERE correo = $1
            AND password_hash = $2
            AND estado = true
            LIMIT 1
        `;

        const result = await pool.query(query, [correo, password]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Correo o contraseña incorrectos"
            });
        }

        res.json({
            success: true,
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Error del servidor"
        });
    }
});
// ===========================
// DASHBOARD CONTADORES
// ===========================
app.get(
    "/api/dashboard/contadores",
    async (req, res) => {

        try {

            const conductor =
                await pool.query(`
                    SELECT COUNT(*)
                    FROM conductor
                    WHERE estado = true
                `);

            const tracto =
                await pool.query(`
                    SELECT COUNT(*)
                    FROM tracto
                    WHERE estado = true
                `);

            const carreta =
                await pool.query(`
                    SELECT COUNT(*)
                    FROM carreta
                    WHERE estado = true
                `);

            res.json({
                conductores:
                    parseInt(
                        conductor.rows[0].count
                    ),

                tractos:
                    parseInt(
                        tracto.rows[0].count
                    ),

                carretas:
                    parseInt(
                        carreta.rows[0].count
                    )
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Error dashboard"
            });
        }
    }
);


// ===========================
// DOCUMENTOS POR VENCER
// ===========================
app.get(
    "/api/dashboard/documentos",
    async (req, res) => {

        try {

            const query = `

            -- DOCUMENTOS CONDUCTOR
            SELECT
                'conductor' AS tipo,
                td.nombre AS titulo,
                dc.fecha_vencimiento AS fecha,
                dc.observacion AS detalle,
                c.nombres || ' ' || c.apellidos AS nombre,
                NULL AS placa,
                NULL AS empresa
            FROM documento_conductor dc
            INNER JOIN conductor c
                ON c.id_conductor =
                dc.id_conductor
            INNER JOIN tipo_documento td
                ON td.id_tipo_documento =
                dc.id_tipo_documento
            WHERE dc.estado = true
            AND dc.fecha_vencimiento
                BETWEEN CURRENT_DATE
                AND CURRENT_DATE + INTERVAL '7 days'

            UNION ALL

            -- DOCUMENTOS TRACTO
            SELECT
                'tracto' AS tipo,
                td.nombre AS titulo,
                dt.fecha_vencimiento AS fecha,
                dt.observacion AS detalle,
                NULL AS nombre,
                t.placa AS placa,
                NULL AS empresa
            FROM documento_tracto dt
            INNER JOIN tracto t
                ON t.id_tracto =
                dt.id_tracto
            INNER JOIN tipo_documento td
                ON td.id_tipo_documento =
                dt.id_tipo_documento
            WHERE dt.estado = true
            AND dt.fecha_vencimiento
                BETWEEN CURRENT_DATE
                AND CURRENT_DATE + INTERVAL '7 days'

            UNION ALL

            -- DOCUMENTOS CARRETA
            SELECT
                'carreta' AS tipo,
                td.nombre AS titulo,
                dc.fecha_vencimiento AS fecha,
                dc.observacion AS detalle,
                NULL AS nombre,
                c.placa AS placa,
                NULL AS empresa
            FROM documento_carreta dc
            INNER JOIN carreta c
                ON c.id_carreta =
                dc.id_carreta
            INNER JOIN tipo_documento td
                ON td.id_tipo_documento =
                dc.id_tipo_documento
            WHERE dc.estado = true
            AND dc.fecha_vencimiento
                BETWEEN CURRENT_DATE
                AND CURRENT_DATE + INTERVAL '7 days'

            UNION ALL

            -- DOCUMENTOS EMPRESA
            SELECT
                'empresa' AS tipo,
                td.nombre AS titulo,
                de.fecha_vencimiento AS fecha,
                de.observacion AS detalle,
                NULL AS nombre,
                NULL AS placa,
                'Documento Empresa'
                    AS empresa
            FROM documento_empresa de
            INNER JOIN tipo_documento td
                ON td.id_tipo_documento =
                de.id_tipo_documento
            WHERE de.estado = true
            AND de.fecha_vencimiento
                BETWEEN CURRENT_DATE
                AND CURRENT_DATE + INTERVAL '7 days'

            ORDER BY fecha ASC
            `;

            const result =
                await pool.query(
                    query
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Error documentos"
            });
        }
    }
);
// ===========================
// LISTAR CONDUCTORES
// ===========================
app.get(
    "/api/conductores",
    async (req, res) => {

        try {

            const query = `
                SELECT *
                FROM conductor
                ORDER BY id_conductor DESC
            `;

            const result =
                await pool.query(
                    query
                );

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Error al cargar conductores"
            });
        }
    }
);
// ==========================
// CONFIG SUBIDA IMAGEN
// ==========================
const storage =
    multer.memoryStorage();

const upload =
    multer({
        storage
    });


// ==========================
// AGREGAR CONDUCTOR
// ==========================
app.post(
    '/api/conductores',
    upload.single('foto'),
    async (req, res) => {

        try {

            let fotoUrl = null;

            // SI HAY FOTO
            if (req.file) {

                const fileName =
                    `conductor_${Date.now()}.webp`;

                const filePath =
                    path.join(
                        __dirname,
                        'uploads',
                        'conductores',
                        fileName
                    );

                // COMPRIMIR
                await sharp(
                    req.file.buffer
                )
                    .resize({
                        width: 900,
                        withoutEnlargement: true
                    })
                    .webp({
                        quality: 75
                    })
                    .toFile(
                        filePath
                    );

                fotoUrl =
                    `${BASE_URL}/uploads/conductores/${fileName}`;
            }

            const {
                nombres,
                apellidos,
                dni,
                telefono,
                correo,
                numero_brevete,
                fecha_inicio_contrato,
                fecha_fin_contrato
            } = req.body;

            const query = `
                INSERT INTO conductor (
                    nombres,
                    apellidos,
                    dni,
                    telefono,
                    correo,
                    numero_brevete,
                    fecha_inicio_contrato,
                    fecha_fin_contrato,
                    foto_url,
                    estado
                )
                VALUES (
                    $1,$2,$3,$4,$5,
                    $6,$7,$8,$9,true
                )
                RETURNING *
            `;

            const values = [
                nombres,
                apellidos,
                dni,
                telefono || null,
                correo || null,
                numero_brevete || null,
                fecha_inicio_contrato || null,
                fecha_fin_contrato || null,
                fotoUrl
            ];

            const result =
                await pool.query(
                    query,
                    values
                );

            res.json({
                success: true,
                conductor:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ==========================
// OBTENER CONDUCTOR POR ID
// ==========================
app.get(
    '/api/conductores/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM conductor
                    WHERE id_conductor = $1
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        message:
                            'Conductor no encontrado'
                    });
            }

            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);


// ==========================
// EDITAR CONDUCTOR
// ==========================
app.put(
    '/api/conductores/:id',
    upload.single('foto'),
    async (req, res) => {

        try {

            const { id } =
                req.params;

            let fotoUrl =
                req.body.foto_actual;

            // NUEVA FOTO
            if (req.file) {

                const fileName =
                    `conductor_${Date.now()}.webp`;

                const filePath =
                    path.join(
                        __dirname,
                        'uploads',
                        'conductores',
                        fileName
                    );

                await sharp(
                    req.file.buffer
                )
                    .resize({
                        width: 900,
                        withoutEnlargement: true
                    })
                    .webp({
                        quality: 75
                    })
                    .toFile(
                        filePath
                    );

                fotoUrl =
                    `${BASE_URL}/uploads/conductores/${fileName}`;
            }

            const {
                nombres,
                apellidos,
                dni,
                telefono,
                correo,
                numero_brevete,
                fecha_inicio_contrato,
                fecha_fin_contrato,
                estado
            } = req.body;

            const query = `
                UPDATE conductor
                SET
                    nombres = $1,
                    apellidos = $2,
                    dni = $3,
                    telefono = $4,
                    correo = $5,
                    numero_brevete = $6,
                    fecha_inicio_contrato = $7,
                    fecha_fin_contrato = $8,
                    foto_url = $9,
                    estado = $10
                WHERE id_conductor = $11
                RETURNING *
            `;

            const values = [
                nombres,
                apellidos,
                dni,
                telefono || null,
                correo || null,
                numero_brevete || null,
                fecha_inicio_contrato || null,
                fecha_fin_contrato || null,
                fotoUrl,
                estado === 'true',
                id
            ];

            const result =
                await pool.query(
                    query,
                    values
                );

            res.json({
                success: true,
                conductor:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ====================================
// LISTAR TIPOS DE DOCUMENTO
// ====================================
app.get(
    '/api/tipos-documento',
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT *
                    FROM tipo_documento
                    ORDER BY id_tipo_documento DESC
                `);

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);


// ====================================
// CAMBIAR ESTADO
// ====================================
app.put(
    '/api/tipos-documento/:id/estado',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const { estado } =
                req.body;

            await pool.query(
                `
                UPDATE tipo_documento
                SET estado = $1
                WHERE id_tipo_documento = $2
                `,
                [estado, id]
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);
// ====================================
// AGREGAR TIPO DOCUMENTO
// ====================================
app.post(
    '/api/tipos-documento',
    async (req, res) => {

        try {

            const {
                nombre,
                categoria,
                requiere_vencimiento,
                estado
            } = req.body;

            const query = `
                INSERT INTO tipo_documento
                (
                    nombre,
                    categoria,
                    requiere_vencimiento,
                    estado
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4
                )
                RETURNING *
            `;

            const values = [
                nombre,
                categoria,
                requiere_vencimiento,
                estado
            ];

            const result =
                await pool.query(
                    query,
                    values
                );

            res.json({
                success: true,
                tipoDocumento:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ==========================
// EDITAR TIPO DOCUMENTO
// ==========================
app.put('/api/tipo-documentos/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const {
            nombre,
            categoria,
            requiere_vencimiento,
            estado
        } = req.body;

        const query = `
            UPDATE tipo_documento
            SET
                nombre = $1,
                categoria = $2,
                requiere_vencimiento = $3,
                estado = $4
            WHERE id_tipo_documento = $5
            RETURNING *
        `;

        const values = [
            nombre,
            categoria,
            requiere_vencimiento,
            estado,
            id
        ];

        const result = await pool.query(query, values);

        res.json({
            success: true,
            tipo_documento: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// OBTENER TIPO DOCUMENTO POR ID
// ==========================
app.get('/api/tipo-documentos/:id', async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM tipo_documento WHERE id_tipo_documento = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Tipo documento no encontrado"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================
// LISTAR DOCUMENTOS
// ==========================
app.get('/api/documentos', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT 
                dc.id_documento,
                dc.id_conductor,
                dc.id_tipo_documento,
                dc.archivo_url,
                dc.fecha_emision,
                dc.fecha_vencimiento,
                dc.estado,
                dc.observacion,

                c.nombres,
                c.apellidos,

                td.nombre AS tipo_nombre

            FROM documento_conductor dc
            LEFT JOIN conductor c ON c.id_conductor = dc.id_conductor
            LEFT JOIN tipo_documento td ON td.id_tipo_documento = dc.id_tipo_documento
            ORDER BY dc.id_documento DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// TOGGLE ESTADO DOCUMENTO
// ==========================
app.put('/api/documentos/:id/estado', async (req, res) => {

    try {

        const { id } = req.params;
        const { estado } = req.body;

        await pool.query(`
            UPDATE documento_conductor
            SET estado = $1
            WHERE id_documento = $2
        `, [estado, id]);

        res.json({ success: true });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// CONDUCTORES ACTIVOS (PARA AGREGAR DOCUMENTO)
// ==========================
app.get('/api/conductores-activos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_conductor, nombres, apellidos
            FROM conductor
            WHERE estado = true
            ORDER BY nombres, apellidos
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// AGREGAR DOCUMENTO
// ==========================
app.post('/api/documentos', uploadDocumentos.single('archivo'), async (req, res) => {

    try {

        const {
            id_conductor,
            id_tipo_documento,
            fecha_emision,
            fecha_vencimiento,
            estado,
            observacion
        } = req.body;

        let archivoUrl = null;

        if (req.file) {

            archivoUrl = `${BASE_URL}/uploads/documentos/${req.file.filename}`;
        }

        const query = `
            INSERT INTO documento_conductor (
                id_conductor,
                id_tipo_documento,
                archivo_url,
                fecha_emision,
                fecha_vencimiento,
                estado,
                observacion
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
        `;

        const values = [
            id_conductor,
            id_tipo_documento,
            archivoUrl,
            fecha_emision,
            fecha_vencimiento || null,
            estado === 'true',
            observacion || null
        ];

        const result = await pool.query(query, values);

        res.json({
            success: true,
            documento: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// EDITAR DOCUMENTOS (CORREGIDO - VALIDAR req.file)
// ==========================
app.put(
    '/api/documentos/:id',
    uploadDocumentos.single('archivo'),
    async (req, res) => {

        try {

            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "ID no recibido"
                });
            }

            // ✅ OBTENER archivo_url ACTUAL DE LA BD primero
            const checkResult = await pool.query(
                `SELECT archivo_url FROM documento_conductor WHERE id_documento = $1`,
                [id]
            );

            let archivoUrl = checkResult.rows[0]?.archivo_url; // ✅ Valor actual por defecto

            // ✅ Si se SUBIÓ un NUEVO archivo, usar el nuevo
            if (req.file) {
                console.log("✅ NUEVO ARCHIVO SUBIDO:");
                console.log("  - fieldname:", req.file.fieldname);
                console.log("  - originalname:", req.file.originalname);
                console.log("  - filename:", req.file.filename);

                archivoUrl = `${BASE_URL}/uploads/documentos/${req.file.filename}`;
            } else {
                console.log("⚠️ req.file es NULL - No se subió archivo");
                console.log("  - req.body.archivo_actual:", req.body.archivo_actual);
            }

            const {
                id_conductor,
                id_tipo_documento,
                fecha_emision,
                fecha_vencimiento,
                observacion
            } = req.body;

            const query = `
                UPDATE documento_conductor
                SET
                    id_conductor = $1,
                    id_tipo_documento = $2,
                    fecha_emision = $3,
                    fecha_vencimiento = $4,
                    observacion = $5,
                    archivo_url = $6
                WHERE id_documento = $7
                RETURNING *
            `;

            const values = [
                id_conductor,
                id_tipo_documento,
                fecha_emision || null,
                fecha_vencimiento || null,
                observacion || null,
                archivoUrl, // ✅ Usar el actual si no hay nuevo
                id
            ];

            const result = await pool.query(query, values);

            res.json({
                success: true,
                documento: result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);
// ==========================
// LISTAR TODOS LOS DOCUMENTOS
// ==========================
app.get('/api/documentos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                dc.id_documento,
                dc.id_conductor,
                dc.id_tipo_documento,
                dc.archivo_url,
                dc.fecha_emision,
                dc.fecha_vencimiento,
                dc.estado,
                dc.observacion,
                dc.created_at,
                c.nombres,
                c.apellidos,
                td.nombre as tipo_documento
            FROM documento_conductor dc
            LEFT JOIN conductor c ON dc.id_conductor = c.id_conductor
            LEFT JOIN tipo_documento td ON dc.id_tipo_documento = td.id_tipo_documento
            ORDER BY dc.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// OBTENER DOCUMENTO POR ID
// ==========================
app.get('/api/documentos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID inválido"
            });
        }

        const result = await pool.query(
            `SELECT * FROM documento_conductor WHERE id_documento = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No encontrado"
            });
        }

        // FIX: Devolver el objeto directamente (no envolver en { success: true })
        res.json(result.rows[0]);

    } catch (err) {
        console.error("ERROR GET DOCUMENTO:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});
app.get('/api/tipos-documento-activos', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT id_tipo_documento, nombre
            FROM tipo_documento
            WHERE estado = true
            ORDER BY nombre
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// TOGGLE ESTADO DOCUMENTO
// ==========================
app.put('/api/documentos/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const query = `
            UPDATE documento_conductor
            SET estado = $1
            WHERE id_documento = $2
            RETURNING *
        `;

        const result = await pool.query(query, [estado, id]);

        res.json({ success: true, documento: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// ==========================
// TRACTOI
// ==========================
// ==========================
// LISTAR TODOS LOS TRACTOS
// ==========================
app.get('/api/documentos-tracto', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                dt.id_documento,
                dt.id_tracto,
                dt.id_tipo_documento,
                dt.archivo_url,
                dt.fecha_emision,
                dt.fecha_vencimiento,
                dt.estado,
                dt.observacion,

                t.placa,
                t.marca,
                t.modelo,

                td.nombre AS tipo_nombre

            FROM documento_tracto dt

            LEFT JOIN tracto t
                ON t.id_tracto = dt.id_tracto

            LEFT JOIN tipo_documento td
                ON td.id_tipo_documento = dt.id_tipo_documento

            ORDER BY dt.id_documento DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================
// cambiar estadp
// ==========================
app.put('/api/documentos-tracto/:id/estado', async (req, res) => {

    try {

        const { id } = req.params;
        const { estado } = req.body;

        await pool.query(`
            UPDATE documento_tracto
            SET estado = $1
            WHERE id_documento = $2
        `, [estado, id]);

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
app.get('/api/tractos-activos', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id_tracto,
                placa,
                marca,
                modelo
            FROM tracto
            WHERE estado = true
            ORDER BY placa
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

const storagePdfTracto = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(
            null,
            'uploads/documentos_tracto'
        );
    },

    filename: (req, file, cb) => {

        cb(
            null,
            `tracto_${Date.now()}_${file.originalname}`
        );
    }
});

const uploadPdfTracto =
    multer({
        storage: storagePdfTracto
    });
// ==========================
// AGREGAR DOCUMENTO TRACTO
// ==========================
app.post(
    '/api/documentos-tracto',
    uploadPdfTracto.single('archivo'),
    async (req, res) => {

        try {

            let archivoUrl = null;

            if (req.file) {

                archivoUrl =
                    `${BASE_URL}/uploads/documentos_tracto/${req.file.filename}`;
            }

            const {
                id_tracto,
                id_tipo_documento,
                fecha_emision,
                fecha_vencimiento,
                observacion
            } = req.body;

            const result =
                await pool.query(`
                    INSERT INTO documento_tracto (
                        id_tracto,
                        id_tipo_documento,
                        archivo_url,
                        fecha_emision,
                        fecha_vencimiento,
                        observacion
                    )
                    VALUES (
                        $1,$2,$3,$4,$5,$6
                    )
                    RETURNING *
                `,
                    [
                        id_tracto,
                        id_tipo_documento,
                        archivoUrl,
                        fecha_emision || null,
                        fecha_vencimiento || null,
                        observacion || null
                    ]
                );

            res.json({
                success: true,
                documento: result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);
// ==========================
// LISTAR TRACTOS
// ==========================
app.get(
    '/api/tractos',
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT *
                    FROM tracto
                    ORDER BY id_tracto DESC
                `);

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ==========================
// CAMBIAR ESTADO TRACTO
// ==========================
app.put(
    '/api/tractos/:id/estado',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const { estado } =
                req.body;

            await pool.query(
                `
                UPDATE tracto
                SET estado = $1
                WHERE id_tracto = $2
                `,
                [estado, id]
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
/////AGREGAR TRACTOS SOLO
// ==========================
// AGREGAR TRACTO
// ==========================
app.post(
    '/api/tractos',
    uploadTractos.single('foto'),
    async (req, res) => {

        try {

            let fotoUrl = null;

            if (req.file) {

                const fileName =
                    `tracto_${Date.now()}.webp`;

                const filePath =
                    path.join(
                        __dirname,
                        'uploads',
                        'tractos',
                        fileName
                    );

                await sharp(
                    req.file.buffer
                )
                    .resize({
                        width: 900,
                        withoutEnlargement: true
                    })
                    .webp({
                        quality: 75
                    })
                    .toFile(
                        filePath
                    );

                fotoUrl =
                    `${BASE_URL}/uploads/tractos/${fileName}`;
            }

            const {
                placa,
                marca,
                modelo,
                anio
            } = req.body;

            const result =
                await pool.query(
                    `
                    INSERT INTO tracto
                    (
                        placa,
                        marca,
                        modelo,
                        anio,
                        foto_url,
                        estado
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$5,true
                    )
                    RETURNING *
                    `,
                    [
                        placa,
                        marca || null,
                        modelo || null,
                        anio || null,
                        fotoUrl
                    ]
                );

            res.json({
                success: true,
                tracto: result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ==========================
// OBTENER TRACTO POR ID
// ==========================
app.get(
    '/api/tractos/:id',
    async (req, res) => {

        try {

            const { id } = req.params;

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM tracto
                    WHERE id_tracto = $1
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Tracto no encontrado'
                });
            }

            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);// ==========================
// EDITAR TRACTO
// ==========================
app.put(
    '/api/tractos/:id',
    uploadTractos.single('foto'),
    async (req, res) => {

        try {

            const { id } =
                req.params;

            let fotoUrl =
                req.body.foto_actual;

            // NUEVA FOTO
            if (req.file) {

                const fileName =
                    `tracto_${Date.now()}.webp`;

                const filePath =
                    path.join(
                        __dirname,
                        'uploads',
                        'tractos',
                        fileName
                    );

                await sharp(
                    req.file.buffer
                )
                    .resize({
                        width: 900,
                        withoutEnlargement: true
                    })
                    .webp({
                        quality: 75
                    })
                    .toFile(
                        filePath
                    );

                fotoUrl =
                    `${BASE_URL}/uploads/tractos/${fileName}`;
            }

            const {
                placa,
                marca,
                modelo,
                anio
            } = req.body;

            const result =
                await pool.query(
                    `
                    UPDATE tracto
                    SET
                        placa = $1,
                        marca = $2,
                        modelo = $3,
                        anio = $4,
                        foto_url = $5
                    WHERE id_tracto = $6
                    RETURNING *
                    `,
                    [
                        placa,
                        marca || null,
                        modelo || null,
                        anio || null,
                        fotoUrl,
                        id
                    ]
                );

            res.json({
                success: true,
                tracto:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ==========================
// LISTAR CARRETAS
// ==========================
app.get('/api/carretas', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                c.id_carreta,
              
                c.placa,
                c.tipo,
                c.id_tracto,
                c.estado,

                t.placa AS tracto_placa,
                t.marca AS tracto_marca

            FROM carreta c

            LEFT JOIN tracto t
                ON t.id_tracto = c.id_tracto

            ORDER BY c.id_carreta DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
// ==========================
// TOGGLE ESTADO CARRETA
// ==========================
app.put(
    '/api/carretas/:id/estado',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const { estado } =
                req.body;

            await pool.query(
                `
                UPDATE carreta
                SET estado = $1
                WHERE id_carreta = $2
                `,
                [
                    estado,
                    id
                ]
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);


// ==========================
// AGREGAR CARRETA
// ==========================
app.post(
    '/api/carretas',
    async (req, res) => {

        try {

            const {
                placa,
                tipo,
                id_tracto
            } = req.body;

            const result =
                await pool.query(
                    `
                    INSERT INTO carreta
                    (
                        placa,
                        tipo,
                        id_tracto,
                        estado
                    )
                    VALUES
                    (
                        $1,$2,$3,true
                    )
                    RETURNING *
                    `,
                    [
                        placa,
                        tipo || null,
                        id_tracto || null
                    ]
                );

            res.json({
                success: true,
                carreta:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ==========================
// OBTENER CARRETA POR ID
// ==========================
app.get(
    '/api/carretas/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM carreta
                    WHERE id_carreta = $1
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        message:
                            'Carreta no encontrada'
                    });
            }

            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);
// ==========================
// ACTUALIZAR CARRETA
// ==========================
app.put(
    '/api/carretas/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const {
                placa,
                tipo,
                id_tracto
            } = req.body;

            const result =
                await pool.query(
                    `
                    UPDATE carreta
                    SET
                        placa = $1,
                        tipo = $2,
                        id_tracto = $3
                    WHERE id_carreta = $4
                    RETURNING *
                    `,
                    [
                        placa,
                        tipo || null,
                        id_tracto || null,
                        id
                    ]
                );

            res.json({
                success: true,
                carreta:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);

// ==========================
// OBTENER DOCUMENTO TRACTO
// ==========================
app.get(
    '/api/documentos-tracto/:id',
    async (req, res) => {

        try {

            const { id } =
                req.params;

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM documento_tracto
                    WHERE id_documento = $1
                    `,
                    [id]
                );

            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        message:
                            'Documento no encontrado'
                    });
            }

            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);
// ==========================
// ACTUALIZAR DOCUMENTO TRACTO
// ==========================
app.put(
    '/api/documentos-tracto/:id',
    uploadDocumentosTracto.single(
        'archivo'
    ),
    async (req, res) => {

        try {

            const { id } =
                req.params;

            let archivoUrl =
                req.body.archivo_actual;

            if (req.file) {

                archivoUrl =
                    `${BASE_URL}/uploads/documentos_tracto/${req.file.filename}`;
            }

            const result =
                await pool.query(
                    `
                    UPDATE documento_tracto
                    SET
                        id_tracto = $1,
                        id_tipo_documento = $2,
                        archivo_url = $3,
                        fecha_emision = $4,
                        fecha_vencimiento = $5,
                        observacion = $6
                    WHERE id_documento = $7
                    RETURNING *
                    `,
                    [
                        req.body.id_tracto,
                        req.body.id_tipo_documento,
                        archivoUrl,
                        req.body.fecha_emision,
                        req.body.fecha_vencimiento || null,
                        req.body.observacion || null,
                        id
                    ]
                );

            res.json({
                success: true,
                documento:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
// ==========================
// LISTAR TRACTOS ACTIVOS
// ==========================
app.get('/api/tractos-activos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM tracto
            WHERE estado = true
            ORDER BY placa
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================
// LISTAR TIPOS DE DOCUMENTO DE CATEGORÍA 'TRACTO' ACTIVOS
// ==========================
app.get('/api/tipos-documento-tracto', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM tipo_documento
            WHERE categoria = 'tracto' AND estado = true
            ORDER BY nombre
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// ==========================
// LISTAR DOCUMENTOS CARRETA
// ==========================
app.get('/api/documentos-carreta', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                dc.id_documento,
                dc.id_carreta,
                dc.id_tipo_documento,
                dc.archivo_url,
                dc.fecha_emision,
                dc.fecha_vencimiento,
                dc.estado,
                dc.observacion,

                c.placa AS carreta_placa,
                c.tipo AS carreta_tipo,

                td.nombre AS tipo_documento

            FROM documento_carreta dc

            INNER JOIN carreta c
                ON c.id_carreta = dc.id_carreta

            INNER JOIN tipo_documento td
                ON td.id_tipo_documento = dc.id_tipo_documento

            ORDER BY dc.id_documento DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});// ==========================
// LISTAR CARRETAS ACTIVAS
// ==========================
app.get('/api/carretas/activas', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM carreta
            WHERE estado = true
            ORDER BY placa
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});// ==========================
// CAMBIAR ESTADO DOCUMENTO
// ==========================
app.put(
    '/api/documentos-carreta/:id/estado',
    async (req, res) => {

        try {

            const { id } = req.params;
            const { estado } = req.body;

            await pool.query(
                `
                UPDATE documento_carreta
                SET estado = $1
                WHERE id_documento = $2
                `,
                [estado, id]
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
); async function cargarCarretas() {

    try {

        const response =
            await fetch(
                '/api/carretas/activas'
            );

        const data =
            await response.json();

        carretasData = data;

        const filtroCarreta =
            document.getElementById(
                'filtroCarreta'
            );

        data.forEach(carreta => {

            const option =
                document.createElement(
                    'option'
                );

            option.value =
                carreta.id_carreta;

            option.textContent =
                `${carreta.placa} - ${carreta.tipo || ''}`.trim();

            filtroCarreta.appendChild(
                option
            );
        });

    } catch (error) {

        console.error(error);
    }
} async function cargarDocumentos() {

    const tbody =
        document.getElementById(
            'tablaCarretaDoc'
        );

    try {

        const response =
            await fetch(
                '/api/documentos-carreta'
            );

        const data =
            await response.json();

        todosLosDocumentos =
            data;

        if (data.length === 0) {

            tbody.innerHTML =
                '<tr><td colspan="9">No hay documentos registrados</td></tr>';

            return;
        }

        mostrarDocumentos(
            data
        );

    } catch (error) {

        console.error(error);

        tbody.innerHTML =
            `<tr>
                <td colspan="9"
                    style="
                        text-align:center;
                        color:red;
                        padding:40px;
                    ">
                    Error: ${error.message}
                </td>
            </tr>`;
    }
}
app.post(
    '/api/documentos-carreta',
    uploadDocumentosCarreta.single(
        'archivo'
    ),
    async (req, res) => {

        try {

            const {
                id_carreta,
                id_tipo_documento,
                fecha_emision,
                fecha_vencimiento,
                observacion
            } = req.body;

            let archivoUrl =
                null;

            if (req.file) {

                archivoUrl =
                    `${BASE_URL}/uploads/documentos_carreta/${req.file.filename}`;
            }

            const result =
                await pool.query(
                    `
                    INSERT INTO documento_carreta
                    (
                        id_carreta,
                        id_tipo_documento,
                        archivo_url,
                        fecha_emision,
                        fecha_vencimiento,
                        observacion,
                        estado
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$5,$6,true
                    )
                    RETURNING *
                    `,
                    [
                        id_carreta,
                        id_tipo_documento,
                        archivoUrl,
                        fecha_emision || null,
                        !fecha_vencimiento ? null : fecha_vencimiento,
                        observacion || null
                    ]
                );

            res.json({
                success: true,
                documento:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message:
                    error.message
            });
        }
    }
);
app.get(
    '/api/tipos-documento/carreta',
    async (req, res) => {

        const result =
            await pool.query(`
                SELECT *
                FROM tipo_documento
                WHERE estado = true
                AND categoria = 'carreta'
                ORDER BY nombre
            `);

        res.json(
            result.rows
        );
    }
);



app.get(
    '/api/documentos-carreta/:id',
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM documento_carreta
                    WHERE id_documento = $1
                    `,
                    [req.params.id]
                );

            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        message:
                            'Documento no encontrado'
                    });
            }

            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);
app.put(
    '/api/documentos-carreta/:id',
    uploadDocumentosCarreta.single(
        'archivo'
    ),
    async (req, res) => {

        try {

            const {
                id_carreta,
                id_tipo_documento,
                fecha_emision,
                fecha_vencimiento,
                observacion
            } = req.body;

            let archivoUrl = null;

            if (req.file) {

                archivoUrl =
                    `${BASE_URL}/uploads/documentos_carreta/${req.file.filename}`;
            }

            if (archivoUrl) {

                await pool.query(
                    `
                    UPDATE documento_carreta
                    SET
                        id_carreta = $1,
                        id_tipo_documento = $2,
                        archivo_url = $3,
                        fecha_emision = $4,
                        fecha_vencimiento = $5,
                        observacion = $6
                    WHERE id_documento = $7
                    `,
                    [
                        id_carreta,
                        id_tipo_documento,
                        archivoUrl,
                        fecha_emision || null,
                        fecha_vencimiento === ''
                            ? null
                            : fecha_vencimiento,
                        observacion || null,
                        req.params.id
                    ]
                );

            } else {

                await pool.query(
                    `
                    UPDATE documento_carreta
                    SET
                        id_carreta = $1,
                        id_tipo_documento = $2,
                        fecha_emision = $3,
                        fecha_vencimiento = $4,
                        observacion = $5
                    WHERE id_documento = $6
                    `,
                    [
                        id_carreta,
                        id_tipo_documento,
                        fecha_emision || null,
                        fecha_vencimiento === ''
                            ? null
                            : fecha_vencimiento,
                        observacion || null,
                        req.params.id
                    ]
                );
            }

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);app.get(
    '/api/tipos-documento/carreta',
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT *
                    FROM tipo_documento
                    WHERE estado = true
                    AND categoria = 'carreta'
                    ORDER BY nombre
                `);

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    error.message
            });
        }
    }
);
// ====================================
// INICIAR SERVIDOR
// ====================================
app.listen(
    process.env.PORT,
    () => {

        console.log(
            `Servidor corriendo en puerto ${process.env.PORT}`
        );
    }
);