import DataBase from "../config/Database.js";

export default class Producto {

    constructor (
        id_producto,
        tituloProducto,
        descripcionProducto,
        valorProducto,
        valor_previo,
        imagenProducto,
        imagenProductoSegunda,
        imagenProductoTercera,
        imagenProductoCuarta,
        estadoProducto,
        categoriaProducto,
        subcategoria,
        subsubcategoria,
        cantidadStock,
        indexCreacionProducto,
        especificacionProducto
    ){
        this.id_producto =id_producto;
        this.tituloProducto = tituloProducto;
        this.descripcionProducto = descripcionProducto;
        this.valorProducto = valorProducto;
        this.valor_previo = valor_previo;
        this.imagenProducto = imagenProducto;
        this.imagenProductoSegunda = imagenProductoSegunda;
        this.imagenProductoTercera = imagenProductoTercera;
        this.imagenProductoCuarta = imagenProductoCuarta;
        this.estadoProducto = estadoProducto;
        this.categoriaProducto = categoriaProducto;
        this.subcategoria = subcategoria;
        this.subsubcategoria = subsubcategoria;
        this.cantidadStock = cantidadStock;
        this.indexCreacionProducto = indexCreacionProducto;
        this.especificacionProducto = especificacionProducto;
    }



    //SELECCION DE PRODUCTOS POR categoriaProducto
    async selectProductoCategoria(categoriaProducto){
        const conexion = DataBase.getInstance();
        // Filtrar solo productos con estado diferente de 0
        const query = 'SELECT * FROM productos WHERE categoriaProducto = ? AND estadoProducto <> 0';
        const param = [categoriaProducto];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if(Array.isArray(resultado) && resultado.length > 0){
                return resultado;
            }else {
                return [];
            }
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }





// ACTUALIZACION DE  PRODUCTO EN LA BASE DE DATOS
  async updateProducto(
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
  ){
    const conexion = DataBase.getInstance();
    const query = 'UPDATE productos SET tituloProducto = ? , descripcionProducto = ?, valorProducto = ? , valor_previo = ?, categoriaProducto = ?, subcategoria = ?, subsubcategoria = ?, imagenProducto = ? ,imagenProductoSegunda = ?, imagenProductoTercera = ?,  imagenProductoCuarta = ?, especificacionProducto = ? where id_producto = ? ';

    const param = [
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
        id_producto];

try {
    const resultado = await conexion.ejecutarQuery(query,param);
    if(resultado){
       return resultado;
    }

} catch (error) {
    throw new Error('NO se logo actualizar Producto  / Problema al establecer la conexion con la base de datos desde la clase Productos.js')

}
  }



// INSERCION DE NUEVO PRODUCTO EN LA BASE DE DATOS
  async insertProducto(tituloProducto, descripcionProducto, valorProducto, valor_previo, categoriaProducto, subcategoria, subsubcategoria, imagenProducto, imagenProductoSegunda, imagenProductoTercera, imagenProductoCuarta, especificacionProducto){
    const conexion = DataBase.getInstance();
    const query = 'INSERT INTO productos (tituloProducto,descripcionProducto, valorProducto, valor_previo, categoriaProducto, subcategoria, subsubcategoria, imagenProducto,imagenProductoSegunda,imagenProductoTercera,imagenProductoCuarta, especificacionProducto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const param = [tituloProducto, descripcionProducto, valorProducto, valor_previo, categoriaProducto, subcategoria, subsubcategoria, imagenProducto, imagenProductoSegunda, imagenProductoTercera, imagenProductoCuarta, especificacionProducto];
try {
    const resultado = await conexion.ejecutarQuery(query,param);
    const filasAfectadas = resultado.affectedRows;
    if (filasAfectadas !== undefined && filasAfectadas !== null) {
        return resultado;
    }
} catch (error) {
    throw new Error('NO se logo ingresar Producto nuevo / Problema al establecer la conexion con la base de datos desde la clase Productos.js')
    
}  
  }





//SELECT * FROM productos WHERE estadoProducto <> 0;
    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS
  async selectProducto(){
    const conexion = DataBase.getInstance();
    const query = 'SELECT * FROM productos WHERE estadoProducto <> 0 ORDER BY id_producto DESC';
try {
    const resultado = await conexion.ejecutarQuery(query);
    return resultado;
} catch (error) {
    throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')
    
}  
  }



    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS POR SIMILITD CUYO ESTADO SEA DIFERENTE DE 0 EL CUAL ES EL ELIMINADO LOGICO
    async selectProductoSimilar(tituloProducto){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM productos WHERE estadoProducto <> 0 AND tituloProducto LIKE ?';
        const param = [`%${tituloProducto}%`];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            if(Array.isArray(resultado)){
                return resultado;
            }else{
                return[];
            }
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }



  //FUNCION PARA ORDERNAR LOS PRODUCTOS DE MANERA QUE SE MUESTREN LOS INGRESADOS MAS RECINETES
    async selectProductoReciente(){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM productos WHERE estadoProducto <> 0 ORDER BY id_producto DESC';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }









    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS QUE ESTAN EN OFERTA (ESTADO PRODUCTO = 3)
    async selectProductoOferta(){
        const conexion = DataBase.getInstance();
        const query = 'SELECT * FROM productos WHERE estadoProducto = 3;';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }













    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS PRECIO ORDEN DEL MENOR A MAYOR
    async seleccionarMenorPrecio(){
        const conexion = DataBase.getInstance();
        // Incluir solo productos activos (estadoProducto <> 0)
        const query = 'SELECT * FROM `productos` WHERE estadoProducto <> 0 ORDER BY `productos`.`valorProducto` ASC';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }



    // SELECCION DE TODOS LOS PRODUCTOS DE LA BASE DE DATOS PRECIO ORDEN DEL MAYOR A MENOR
    async seleccionarMayorPrecio(){
        const conexion = DataBase.getInstance();
        // Incluir solo productos activos (estadoProducto <> 0)
        const query = 'SELECT * FROM `productos` WHERE estadoProducto <> 0 ORDER BY `productos`.`valorProducto` DESC';
        try {
            const resultado = await conexion.ejecutarQuery(query);
            return resultado;
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }





//METODO PARA SELECCIONAR PRODUCTO ESPECIFICO POR ID DE PRODUCTO EN LA BASE DE DATOS
    async selectProductoEspecifico(id_producto){
    const conexion = DataBase.getInstance();
    // Asegurar que el producto no esté marcado como eliminado (estadoProducto <> 0)
    const query = 'SELECT * FROM productos WHERE id_producto = ? AND estadoProducto <> 0';
    const param = [id_producto];
try {
 const resultado = await conexion.ejecutarQuery(query, param);
  if(resultado){
    return resultado[0];
  }
   
} catch (error) {
    throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')
    
}  
  }











// ELIMINACION LOGICA DE PRODUCTO EN LA BASE DE DATOS
  async eliminarProducto(id_producto){
    const conexion = DataBase.getInstance();
    const query = 'UPDATE productos SET estadoProducto = 0 where id_producto = ?';
    const param = [id_producto];
try {
    const resultado = await conexion.ejecutarQuery(query,param);
   if(resultado){
       return resultado;
   }

} catch (error) {
    throw new Error('NO se logo eliminar Producto  / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
}  
  }







//FUNCION PARA MARCAR EL PRODUCTO COMO EN OFERTA EN BASE DE DATOS OFERTA CORRESPONDE AL ESTADO 3
    async marcarProductoOferta(id_producto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE productos SET estadoProducto = 3 where id_producto = ?';
        const param = [id_producto];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se marco Producto producto como oferta estado 3  / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
        }
    }









//FUNCION PARA MARCAR EL PRODUCTO COMO SIN OFERTA EN BASE DE DATOS OFERTA CORRESPONDE AL ESTADO 1
    async marcarProductoNormal(id_producto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE productos SET estadoProducto = 1 where id_producto = ?';
        const param = [id_producto];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            const filasAfectadas = resultado.affectedRows;
            if (filasAfectadas !== undefined && filasAfectadas !== null) {
                return filasAfectadas;
            } else {
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se marco Producto producto como oferta estado 3  / Problema al establecer la conexion con la base de datos desde la clase Pacientes.js')
        }
    }






    // FUNCION PARA ACTUALIZAR STOCK DE PRODUCTO EN LA BASE DE DATOS
    async actualizarStock(cantidadStock, id_producto){
        const conexion = DataBase.getInstance();
        const query = 'UPDATE productos SET cantidadStock = ? WHERE id_producto = ?';
        const param = [cantidadStock, id_producto];
        try {
            const resultado = await conexion.ejecutarQuery(query,param);
            if(resultado){
                return resultado;
            }
        } catch (error) {
            throw new Error('NO se logro actualizar  / Problema al establecer la conexion con la base de datos desde la clase Producto.js')
        }
    }












    //SELECCION DE PRODUCTOS POR subcategoria Producto
    async selectProductoSubCategoria(subCategoria){
        const conexion = DataBase.getInstance();
        // Filtrar solo productos con estado diferente de 0
        const query = 'SELECT * FROM productos WHERE subCategoria = ? AND estadoProducto <> 0';
        const param = [subCategoria];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if(Array.isArray(resultado) && resultado.length > 0){
                return resultado;
            }else {
                return [];
            }
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }



    async selectProductoSubSubCategoria(subsubcategoria){
        const conexion = DataBase.getInstance();
        // Filtrar solo productos con estado diferente de 0
        const query = 'SELECT * FROM productos WHERE subsubcategoria = ? AND estadoProducto <> 0';
        const param = [subsubcategoria];
        try {
            const resultado = await conexion.ejecutarQuery(query, param);
            if(Array.isArray(resultado) && resultado.length > 0){
                return resultado;
            }else {
                return [];
            }
        } catch (error) {
            throw new Error('Problema al establecer la conexion con la base de datos desde la clase Productos.js')

        }
    }

}
