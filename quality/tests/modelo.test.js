import { IncidentModel } from '../../js/model.js';

describe('Modelo y respuestas HTTP', () => {
  afterEach(() => { delete global.fetch; });

  test('carga la lista autenticada y entrega copias', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [{ id: 1, codigo: 'INC-001' }]
    });
    const model = new IncidentModel();
    model.token = 'token-de-prueba';
    const lista = await model.loadIncidents();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token-de-prueba');
    lista[0].codigo = 'modificado';
    expect(model.getIncidentById(1).codigo).toBe('INC-001');
  });

  test('rechaza una respuesta que no es lista', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expect(new IncidentModel().loadIncidents()).rejects.toThrow(/lista válida/);
  });

  test('401 limpia la sesión y conserva el mensaje de la API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ error: 'Sesión vencida.' })
    });
    const model = new IncidentModel();
    model.token = 'token-de-prueba';
    model.user = { rol: 'lector' };
    const avisar = jest.fn();
    model.onSessionExpired = avisar;
    await expect(model.loadIncidents()).rejects.toThrow('Sesión vencida.');
    expect(model.user).toBeNull();
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  test('204 no intenta leer JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    const model = new IncidentModel();
    model.incidents = [{ id: 3 }];
    await model.deleteIncident(3);
    expect(model.getIncidents()).toEqual([]);
  });

  test('subir evidencia actualiza el registro local con la respuesta del POST', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ evidencia: { nombre_original: 'prueba.png' } })
    });
    const model = new IncidentModel();
    model.incidents = [{ id: 3, evidencia: 'Sin evidencia adjunta' }];
    await model.uploadEvidence(3, new File(['contenido'], 'prueba.png'));
    expect(model.getIncidentById(3).evidencia).toBe('prueba.png');
  });
});
