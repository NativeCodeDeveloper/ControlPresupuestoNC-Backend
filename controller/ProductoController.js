import Producto from "../model/Producto.js";

export default class ProductoController {

    static async seleccionarProductoCategoria(req, res) {
        try {
            const { categoriaProducto } = req.body;
            const producto = new Producto();
            if (!categoriaProducto) return res.status(404).json({ message: "sindato" });
            const dataProducto = await producto.selectProductoCategoria(categoriaProducto);
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({ message: "sindato" });
        }
    }

    static async seleccionarProductoSimilar(req, res) {
        try {
            const { tituloProducto } = req.body;
            const producto = new Producto();
            if (!tituloProducto) return res.status(404).json({ message: "sindato" });
            const dataProducto = await producto.selectProductoSimilar(tituloProducto);
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({ message: "sindato" });
        }
    }

    static async actualizarProducto(req, res) {
        try {
            const {
                tituloProducto, descripcionProducto, valorProducto, valor_previo,
                categoriaProducto, subcategoria, subsubcategoria,
                imagenProducto, imagenProductoSegunda, imagenProductoTercera,
                imagenProductoCuarta, especificacionProducto, id_producto
            } = req.body;

            if (!tituloProducto || !descripcionProducto || !valorProducto || !valor_previo ||
                !categoriaProducto || !subcategoria || !subsubcategoria ||
                !especificacionProducto || !imagenProducto || !id_producto) {
                return res.status(400).json({ message: "sindato" });
            }

            const producto = new Producto();
            const resultado = await producto.updateProducto(
                tituloProducto, descripcionProducto, valorProducto, valor_previo,
                categoriaProducto, subcategoria, subsubcategoria,
                imagenProducto, imagenProductoSegunda, imagenProductoTercera,
                imagenProductoCuarta, especificacionProducto, id_producto
            );
            if (resultado.affectedRows > 0) return res.status(200).json({ message: "ok" });
            return res.status(404).json({ message: "sindato" });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async insertarProducto(req, res) {
        try {
            const {
                tituloProducto, descripcionProducto, valorProducto, valor_previo,
                categoriaProducto, subcategoria, subsubcategoria,
                imagenProducto, imagenProductoSegunda, imagenProductoTercera,
                imagenProductoCuarta, especificacionProducto
            } = req.body;

            if (!tituloProducto || !descripcionProducto || !valorProducto || !valor_previo ||
                !categoriaProducto || !subcategoria || !subsubcategoria || !imagenProducto) {
                return res.status(400).json({ message: "sindato" });
            }

            const producto = new Producto();
            const resultado = await producto.insertProducto(
                tituloProducto, descripcionProducto, valorProducto, valor_previo,
                categoriaProducto, subcategoria, subsubcategoria,
                imagenProducto, imagenProductoSegunda, imagenProductoTercera,
                imagenProductoCuarta, especificacionProducto
            );
            if (resultado.affectedRows > 0) return res.json({ message: "ok" });
            return res.status(400).json({ message: "sinfilasafectadas" });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarTodosProductos(req, res) {
        try {
            const producto = new Producto();
            return res.json(await producto.selectProducto());
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarProductosRecientes(req, res) {
        try {
            const producto = new Producto();
            return res.json(await producto.selectProductoReciente());
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarTodosProductosOferta(req, res) {
        try {
            const producto = new Producto();
            return res.json(await producto.selectProductoOferta());
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarTodosProductosMenorPrecio(req, res) {
        try {
            const producto = new Producto();
            const dataProducto = await producto.seleccionarMenorPrecio();
            if (!dataProducto || (Array.isArray(dataProducto) && dataProducto.length === 0)) {
                return res.status(404).json({ message: "sindato" });
            }
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarTodosProductosMayorPrecio(req, res) {
        try {
            const producto = new Producto();
            return res.json(await producto.seleccionarMayorPrecio());
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarProductoEspecifico(req, res) {
        try {
            const { id_producto } = req.params;
            const producto = new Producto();
            if (!id_producto) {
                return res.status(404).json({ message: "ID de producto no proporcionado" });
            }
            const dataProducto = await producto.selectProductoEspecifico(id_producto);
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async eliminarProducto(req, res) {
        try {
            const { id_producto } = req.body;
            if (!id_producto) return res.status(400).json({ message: "sindato" });
            const producto = new Producto();
            const resultado = await producto.eliminarProducto(id_producto);
            if (resultado.affectedRows > 0) return res.json({ message: "ok" });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta de eliminacion del producto desde ProductoController.js" });
        }
    }

    static async marcarProductoComoOferta(req, res) {
        try {
            const { id_producto } = req.body;
            if (!id_producto) return res.status(400).json({ message: "sindato" });
            const producto = new Producto();
            const resultado = await producto.marcarProductoOferta(id_producto);
            if (!resultado) return res.status(404).json({ message: "sindato" });
            return res.json({ message: "ok" });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async marcarProductoNormal(req, res) {
        try {
            const { id_producto } = req.body;
            if (!id_producto) return res.status(400).json({ message: "sindato" });
            const producto = new Producto();
            const resultado = await producto.marcarProductoNormal(id_producto);
            if (!resultado) return res.status(404).json({ message: "sindato" });
            return res.json({ message: "ok" });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async actualizarStock(req, res) {
        try {
            const { cantidadStock, id_producto } = req.body;
            if (!id_producto) return res.status(400).json({ message: "sindato no viene el id_producto" });
            const producto = new Producto();
            const resultado = await producto.actualizarStock(cantidadStock, id_producto);
            if (resultado.affectedRows > 0) return res.status(200).json({ message: "ok" });
            return res.status(404).json({ message: "sindato no hay filas afectadas" });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }

    static async seleccionarProductoSubcategoria(req, res) {
        try {
            const { subCategoria } = req.body;
            const producto = new Producto();
            if (!subCategoria) return res.status(404).json({ message: "sindato" });
            return res.json(await producto.selectProductoSubCategoria(subCategoria));
        } catch (error) {
            res.status(500).json({ message: "sindato" });
        }
    }

    static async seleccionarProductoSubSubcategoria(req, res) {
        try {
            const { subsubcategoria } = req.body;
            const producto = new Producto();
            if (!subsubcategoria) return res.status(404).json({ message: "sindato" });
            return res.json(await producto.selectProductoSubSubCategoria(subsubcategoria));
        } catch (error) {
            res.status(500).json({ message: "sindato" });
        }
    }
}
