import { IncidentController } from '../../js/controller.js';

test('después de subir evidencia reutiliza la respuesta sin pedir toda la lista', async () => {
  const model = {
    user: { rol: 'analista' },
    createIncident: jest.fn().mockResolvedValue({ id: 3, codigo: 'INC-003' }),
    uploadEvidence: jest.fn().mockResolvedValue({ evidencia: { nombre_original: 'prueba.png' } }),
    loadIncidents: jest.fn().mockResolvedValue([]),
    getIncidentById: jest.fn().mockReturnValue({ id: 3, codigo: 'INC-003', evidencia: 'prueba.png' })
  };
  const view = {
    form: { elements: { evidencia: { files: [{ name: 'prueba.png' }] } } },
    showErrorSummary: jest.fn(), setSubmitting: jest.fn(), getFormData: jest.fn().mockReturnValue({}),
    setEditMode: jest.fn(), resetForm: jest.fn(), showOperationMessage: jest.fn(),
    announce: jest.fn()
  };
  const controller = new IncidentController(model, view);
  controller.validateForm = () => [];
  controller.selectIncident = jest.fn();
  controller.renderFilteredIncidents = jest.fn();
  global.document = { getElementById: () => ({ scrollIntoView: jest.fn() }) };

  await controller.handleSubmit({ preventDefault: jest.fn() });

  expect(model.createIncident).toHaveBeenCalledTimes(1);
  expect(model.uploadEvidence).toHaveBeenCalledTimes(1);
  expect(model.loadIncidents).not.toHaveBeenCalled();
  delete global.document;
});
