import Producto from "../model/Producto.js";

export default class ProductoController {
  constructor() {}



    // SELECCION DE LOS PRODUCTOS DE LA BASE DE DATOS CATEGORIA POR ID
    static async seleccionarProductoCategoria(req, res) {
        try {
            const { categoriaProducto } = req.body;
            console.log(categoriaProducto);
            const producto = new Producto();

            if (!categoriaProducto) {
               return res.status(404).json({message:"sindato"});

            } else {
                const dataProducto = await producto.selectProductoCategoria(categoriaProducto);
                return res.json(dataProducto);
            }
        } catch (error) {
            res.status(500).json({message: "sindato",});
        }
    }




    // SELECCION DE LOS PRODUCTOS DE LA BASE DE DATOS CATEGORIA POR SIMILITUD DE NOMBRE
    static async seleccionarProductoSimilar(req, res) {
        try {
            const { tituloProducto } = req.body;
            console.log(tituloProducto);
            const producto = new Producto();

            if (!tituloProducto ) {
                return res.status(404).json({message:"sindato"});

            } else {
                const dataProducto = await producto.selectProductoSimilar(tituloProducto);
                return res.json(dataProducto);
            }
        } catch (error) {
            res.status(500).json({message: "sindato",});
        }
    }




//ACTUALIZAR PRODUCTO EN LA BASE DE DATOS
  static async actualizarProducto(req, res) {
    try {
      console.log(req.body);
      const {
        tituloProducto,
        descripcionProducto,
        valorProducto,
          valor_previo,
        categoriaProducto,
          subcategoria,
          subsubcategoria,
        imagenProducto,
        imagenProductoSegunda,
        imagenProductoTercera,
        imagenProductoCuarta,
        especificacionProducto,
        id_producto
      } = req.body;

      if (!tituloProducto ||
        !descripcionProducto ||
        !valorProducto ||
          !valor_previo ||
          !categoriaProducto ||
          !subcategoria ||
          !subsubcategoria ||
          !especificacionProducto||
        !imagenProducto||
        !id_producto
      ) {
        return res.status(400).json({ message: "sindato" });
      }

      const producto = new Producto();
      const resultado = await producto.updateProducto(
          tituloProducto,
          descripcionProducto,
          valorProducto,
          valor_previo,
          categoriaProducto,
          subcategoria,
          subsubcategoria,
          imagenProducto,
          imagenProductoSegunda,
          imagenProductoTercera,
          imagenProductoCuarta,
          especificacionProducto,
          id_producto
      );

      console.log('Resultado updateProducto:', resultado);

      if (resultado.affectedRows > 0) {
          return res.status(200).json({message:"ok"});
      }else {
          return res.status(404).json({message:"sindato"});
      }

    } catch (error) {
      res.status(500).json({
        error:
          "No se ha podido realizar la consulta desde ProductoController.js",
      });
    }
  }





//INSERTAR NUEVO PRODUCTO EN LA BASE DE DATOS
  static async insertarProducto(req, res) {
    try {
      console.log(req.body);
      const {
          tituloProducto,
          descripcionProducto,
          valorProducto,
          valor_previo,
          categoriaProducto,
          subcategoria,
          subsubcategoria,
          imagenProducto,
          imagenProductoSegunda,
          imagenProductoTercera,
          imagenProductoCuarta,
          especificacionProducto
      } = req.body;

      if (!tituloProducto || !descripcionProducto || !valorProducto || !valor_previo || !categoriaProducto ||!subcategoria || !subsubcategoria || !imagenProducto) {
        return res.status(400).json({ message: "sindato" });
      }

      const producto = new Producto();
      const resultado = await producto.insertProducto(
          tituloProducto,
          descripcionProducto,
          valorProducto,
          valor_previo,
          categoriaProducto,
          subcategoria,
          subsubcategoria,
          imagenProducto,
          imagenProductoSegunda,
          imagenProductoTercera,
          imagenProductoCuarta,
          especificacionProducto
      );

      if (resultado.affectedRows > 0) {
          return res.json({message: "ok"});
      }else {
          return res.status(400).json({message: "sinfilasafectadas"});
      }
    } catch (error) {
      res.status(500).json({
        error:
          "No se ha podido realizar la consulta desde ProductoController.js",
      });
    }
  }

  // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS
  static async seleccionarTodosProductos(req, res) {
    try {
      const producto = new Producto();
      const dataProducto = await producto.selectProducto();
      return res.json(dataProducto);
    } catch (error) {
      res.status(500).json({
        error:
          "No se ha podido realizar la consulta desde ProductoController.js",
      });
    }
  }




    // SELECCION DE TODOS LOS PRODUCTOS INGRESADOS RECIENTEMENTE A LA BASE DE DATOS
    static async seleccionarProductosRecientes(req, res) {
        try {
            const producto = new Producto();
            const dataProducto = await producto.selectProductoReciente();
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde ProductoController.js",
            });
        }
    }


    // SELECCION DE TODOS LOS PRODUCTOS EN OFERTA (ESTADO 3) DE LA BASE DE DATOS
    static async seleccionarTodosProductosOferta(req, res) {
        try {
            const producto = new Producto();
            const dataProducto = await producto.selectProductoOferta();
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde ProductoController.js",
            });
        }
    }




    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS PRECIO ORDEN DEL MENOR A MAYOR
    static async seleccionarTodosProductosMenorPrecio(req, res) {
        try {
            const producto = new Producto();
            const dataProducto = await producto.seleccionarMenorPrecio();

            if (!dataProducto || (Array.isArray(dataProducto) && dataProducto.length === 0)) {
                return res.status(404).json({message:"sindato"});
            }else {
                return res.json(dataProducto);
            }
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde ProductoController.js",
            });
        }
    }



    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS PRECIO ORDEN DEL MAYOR A MENOR
    static async seleccionarTodosProductosMayorPrecio(req, res) {
        try {
            const producto = new Producto();
            const dataProducto = await producto.seleccionarMayorPrecio();
            return res.json(dataProducto);
        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde ProductoController.js",
            });
        }
    }



  // SELECCION DE LOS PRODUCTOS DE LA BASE DE DATOS ESPECIFICOS POR ID
  // SE USA req.params y NO req.body porque es una peticion get en body solo se usa en PUT Y POST
  static async seleccionarProductoEspecifico(req, res) {
    try {
      const { id_producto } = req.params;
      console.log(id_producto);
      const producto = new Producto();

      if (!id_producto) {
        res
          .status(404)
          .json({
            message:
              "No se ha podido realizar la consulta desde producto controller por falta de informacion desde el fronent para sleccionar producto especifico",
          });
      } else {
        const dataProducto = await producto.selectProductoEspecifico(
          id_producto
        );
        return res.json(dataProducto);
      }
    } catch (error) {
      res.status(500).json({
        error:
          "No se ha podido realizar la consulta desde ProductoController.js",
      });
    }
  }



  static async eliminarProducto(req, res) {
    try {
        console.log(req.body);
      const {id_producto} = req.body;

      if (!id_producto) {
        return res.status(400).json({ message: "sindato" });
      }

      const producto = new Producto();
      const resultado = await producto.eliminarProducto(id_producto);
      if (resultado.affectedRows > 0) {
          return res.json({message: "ok"});
      }
    } catch (error) {
      res.status(500).json({error: "No se ha podido realizar la consulta de eliminacion del producto desde ProductoController.js",
      });
    }
  }


  // FUNCION CONTROLLER PARA MARCAR EL PRODUCTO COMO OFERTA EN LA BASE DE DATOS (OFERTA CORRESPONDE AL ESTADO 3 EN LA TABLA PRODUCTOS)
    static async marcarProductoComoOferta(req, res) {
        try {
            const {id_producto} = req.body;
            console.log(req.body);

            if (!id_producto) {
                return res.status(400).json({ message: "sindato" });
            }
            const producto = new Producto();
            const resultado = await producto.marcarProductoOferta(id_producto);

            if (!resultado) {
                return res.status(404).json({message:"sindato"});

            }else {
                return res.json({message:"ok"});
            }


        } catch (error) {
            res.status(500).json({error: "No se ha podido realizar la consulta desde ProductoController.js",});
        }
    }









    // FUNCION CONTROLLER PARA MARCAR EL PRODUCTO COMO SIN OFERTA EN LA BASE DE DATOS (OFERTA CORRESPONDE AL ESTADO 1 EN LA TABLA PRODUCTOS)
    static async marcarProductoNormal(req, res) {
        try {
            const {id_producto} = req.body;
            console.log(req.body);

            if (!id_producto) {
                return res.status(400).json({ message: "sindato" });
            }
            const producto = new Producto();
            const resultado = await producto.marcarProductoNormal(id_producto);

            if (!resultado) {
                return res.status(404).json({message:"sindato"});

            }else {
                return res.json({message:"ok"});
            }


        } catch (error) {
            res.status(500).json({error: "No se ha podido realizar la consulta desde ProductoController.js",});
        }
    }








//ACTUALIZAR STOCK EN LA BASE DE DATOS
    static async actualizarStock(req, res) {
        try {
            console.log(req.body);
            const {cantidadStock, id_producto} = req.body;

            if (!id_producto){
                return res.status(400).json({ message: "sindato no viene el id_producto" });
            }

            const producto = new Producto();
            const resultado = await producto.actualizarStock(cantidadStock, id_producto);

            console.log('Resultado updateProducto:', resultado);

            if (resultado.affectedRows > 0) {
                return res.status(200).json({message:"ok"});
            }else {
                return res.status(404).json({message:"sindato no hay filas afectadas"});
            }

        } catch (error) {
            res.status(500).json({
                error:
                    "No se ha podido realizar la consulta desde ProductoController.js",
            });
        }
    }







    // SELECCION DE LOS PRODUCTOS DE LA BASE DE DATOS CATEGORIA POR ID
    static async seleccionarProductoSubcategoria(req, res) {
        try {
            const { subCategoria } = req.body;
            console.log(subCategoria);
            const producto = new Producto();

            if (!subCategoria) {
                return res.status(404).json({message:"sindato"});

            } else {
                const dataProducto = await producto.selectProductoSubCategoria(subCategoria);
                return res.json(dataProducto);
            }
        } catch (error) {
            res.status(500).json({message: "sindato",});
        }
    }









    // SELECCION DE LOS PRODUCTOS DE LA BASE DE DATOS CATEGORIA POR ID
    static async seleccionarProductoSubSubcategoria(req, res) {
        try {
            const { subsubcategoria } = req.body;
            console.log(subsubcategoria);
            const producto = new Producto();

            if (!subsubcategoria) {
                return res.status(404).json({message:"sindato"});

            } else {
                const dataProducto = await producto.selectProductoSubSubCategoria(subsubcategoria)
                return res.json(dataProducto);
            }
        } catch (error) {
            res.status(500).json({message: "sindato",});
        }
    }
}