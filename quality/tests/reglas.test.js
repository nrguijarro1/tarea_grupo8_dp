import { fieldRules, filterIncidents } from '../../js/rules.js';

const campo = (value) => ({ value });

describe('Reglas del formulario', () => {
  test.each([
    ['tipo', 'malware'], ['prioridad', 'alta'], ['estado', 'En revisión'],
    ['estado', 'En progreso'], ['estado', 'Cerrado']
  ])('%s acepta %s', (nombre, valor) => {
    expect(fieldRules[nombre](campo(valor))).toBe('');
  });

  test.each([
    ['tipo', 'desconocido'], ['prioridad', 'urgente'], ['estado', 'Pendiente']
  ])('%s rechaza %s', (nombre, valor) => {
    expect(fieldRules[nombre](campo(valor))).not.toBe('');
  });

  test('descripción acepta límites de 30 y 600 caracteres', () => {
    expect(fieldRules.descripcion(campo('a'.repeat(30)))).toBe('');
    expect(fieldRules.descripcion(campo('a'.repeat(600)))).toBe('');
    expect(fieldRules.descripcion(campo('a'.repeat(29)))).toMatch(/Faltan 1/);
    expect(fieldRules.descripcion(campo('a'.repeat(601)))).toMatch(/600/);
  });

  test('fecha obligatoria y futura se rechazan', () => {
    expect(fieldRules.fecha(campo(''))).not.toBe('');
    expect(fieldRules.fecha(campo('9999-12-31'))).toMatch(/futuro/);
    expect(fieldRules.fecha(campo('2020-01-01'))).toBe('');
  });

  test('archivo valida extensión, tamaño y contenido vacío', () => {
    expect(fieldRules.evidencia({ files: [] })).toBe('');
    expect(fieldRules.evidencia({ files: [{ name: 'a.exe', size: 10 }] })).not.toBe('');
    expect(fieldRules.evidencia({ files: [{ name: 'a.png', size: 0 }] })).not.toBe('');
    expect(fieldRules.evidencia({ files: [{ name: 'a.png', size: 5 * 1024 * 1024 + 1 }] })).not.toBe('');
    expect(fieldRules.evidencia({ files: [{ name: 'a.png', size: 5 * 1024 * 1024 }] })).toBe('');
  });
});

describe('Filtros de incidentes', () => {
  const registros = [
    { codigo: 'INC-001', tipo: 'malware', tipoTexto: 'Malware', prioridad: 'alta', estado: 'Registrado', descripcion: 'Equipo afectado', responsable: 'SOC' },
    { codigo: 'INC-002', tipo: 'phishing', tipoTexto: 'Phishing', prioridad: 'baja', estado: 'Cerrado', descripcion: 'Correo sospechoso', responsable: 'Mesa' }
  ];
  const vacios = { busqueda: '', tipo: '', prioridad: '', estado: '' };

  test('combina texto y filtros sin mutar los datos', () => {
    const copia = structuredClone(registros);
    expect(filterIncidents(registros, { ...vacios, busqueda: 'equipo', prioridad: 'alta' }))
      .toEqual([registros[0]]);
    expect(filterIncidents(registros, { ...vacios, estado: 'Cerrado' })).toEqual([registros[1]]);
    expect(filterIncidents(registros, { ...vacios, tipo: 'malware' })).toEqual([registros[0]]);
    expect(registros).toEqual(copia);
  });
});
