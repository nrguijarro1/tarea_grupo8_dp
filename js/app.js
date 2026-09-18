import { IncidentModel } from './model.js';
import { IncidentView } from './view.js';
import { IncidentController } from './controller.js';

const model = new IncidentModel('./assets/incidentes.json');
const view = new IncidentView();
const controller = new IncidentController(model, view);

controller.init();
