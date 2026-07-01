import { Router } from 'express';
import SynapseController from '../controller/SynapseController.js';

const router = Router();

// Estados (columnas Kanban)
router.get('/estados',              SynapseController.getEstados);
router.post('/estados',             SynapseController.createEstado);
router.patch('/estados/reorder',    SynapseController.reorderEstados);
router.put('/estados/:id',          SynapseController.updateEstado);
router.delete('/estados/:id',       SynapseController.deleteEstado);

// Etiquetas
router.get('/etiquetas',            SynapseController.getEtiquetas);
router.post('/etiquetas',           SynapseController.createEtiqueta);
router.put('/etiquetas/:id',        SynapseController.updateEtiqueta);
router.delete('/etiquetas/:id',     SynapseController.deleteEtiqueta);

// Tareas
router.get('/tareas',               SynapseController.getTareas);
router.post('/tareas',              SynapseController.createTarea);
router.get('/tareas/:id',           SynapseController.getTareaById);
router.put('/tareas/:id',           SynapseController.updateTarea);
router.patch('/tareas/:id/estado',  SynapseController.updateTareaEstado);
router.delete('/tareas/:id',        SynapseController.deleteTarea);

// Comentarios
router.get('/tareas/:id/comentarios',          SynapseController.getComentarios);
router.post('/tareas/:id/comentarios',         SynapseController.createComentario);
router.delete('/tareas/:id/comentarios/:cid',  SynapseController.deleteComentario);

// Meta (datos de referencia para formularios)
router.get('/meta/proyectos',       SynapseController.getProyectosParaSynapse);
router.get('/meta/socios',          SynapseController.getSociosParaSynapse);

export default router;
