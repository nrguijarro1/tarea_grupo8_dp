import { IncidentController } from '../../js/controller.js';

describe('Validación de la descripción', () => {
  test('rechaza caracteres de formato invisibles antes de enviar la solicitud', () => {
    const view = { showFieldError: jest.fn() };
    const controller = new IncidentController({}, view);
    const field = {
      name: 'descripcion',
      value: 'Se detectó actividad sospechosa\u200b en el servidor principal.'
    };

    expect(controller.validateField(field)).toMatch(/caracteres de control/i);
    expect(view.showFieldError).toHaveBeenCalledWith(field, expect.any(String));
  });
});
