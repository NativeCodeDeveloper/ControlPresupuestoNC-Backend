import Categorias from "../model/Categorias.js";

export default class CategoriasController {

    static async actualizarCategoria(req, res) {
        try {
            const { descripcionCategoria, id_categoriaProducto } = req.body;
            if (!descripcionCategoria || !id_categoriaProducto) {
                return res.status(400).json({ message: "Faltan datos obligatorios en el body" });
            }
            const categoria = new Categorias();
            const resultado = await categoria.actualizarCategoria(descripcionCategoria, id_categoriaProducto);
            if (resultado === 1) return res.json({ message: true });
            return res.json({ message: false });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde CategoriaController.js" });
        }
    }

    static async insertarCategoria(req, res) {
        try {
            const { descripcionCategoria } = req.body;
            if (!descripcionCategoria) {
                return res.status(400).json({ message: "Faltan datos obligatorios en el body" });
            }
            const categoria = new Categorias();
            const resultado = await categoria.insertarNuevaCategoria(descripcionCategoria);
            if (resultado) return res.json({ resultado: true });
            return res.json({ resultado: false });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde CategoriaController.js" });
        }
    }

    static async seleccionarTodasCategorias(req, res) {
        try {
            const categoria = new Categorias();
            return res.json(await categoria.seleccionarTodasCategorias());
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde CategoriaController.js" });
        }
    }

    static async seleccionCategoriasPorId(req, res) {
        try {
            const { id_categoriaProducto } = req.params;
            if (!id_categoriaProducto) return res.status(400).json({ message: 'sindato' });
            const categoria = new Categorias();
            const resultado = await categoria.seleccionarCategoriaEspecifica(id_categoriaProducto);
            if (!resultado) return res.status(404).json({ message: 'sindato' });
            return res.json(resultado);
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde CategoriaController.js" });
        }
    }

    static async eliminarCategoria(req, res) {
        try {
            const { id_categoriaProducto } = req.body;
            if (!id_categoriaProducto) return res.status(400).json({ message: "sindato" });
            const categoria = new Categorias();
            const resultado = await categoria.eliminarCategoria(id_categoriaProducto);
            if (resultado === 1) return res.status(200).json({ message: true });
            return res.status(404).json({ message: false });
        } catch (error) {
            res.status(500).json({ error: "No se ha podido realizar la consulta desde ProductoController.js" });
        }
    }
}
