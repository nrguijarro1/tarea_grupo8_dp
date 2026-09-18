const fs = require('fs/promises');

class IncidenteRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async listar() {
    const contenido = await fs.readFile(this.filePath, 'utf8');
    const incidentes = JSON.parse(contenido);
    if (!Array.isArray(incidentes)) {
      throw new TypeError('El archivo de incidentes no contiene un arreglo JSON.');
    }
    return incidentes;
  }

  async guardarTodos(incidentes) {
    const contenido = `${JSON.stringify(incidentes, null, 2)}\n`;
    await fs.writeFile(this.filePath, contenido, 'utf8');
  }
}

module.exports = IncidenteRepository;
