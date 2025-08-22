jest.mock('pdf-parse', () => jest.fn());

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../src/index');
const pdfParse = require('pdf-parse');

jest.spyOn(process, 'exit').mockImplementation(() => {});

describe('Upload Routes', () => {
  beforeEach(() => {
    pdfParse.mockResolvedValue({ text: 'texte simulé' });
  });

  it('devrait appeler handleUpload avec un fichier et retourner 200', async () => {
    const filePath = path.resolve(__dirname, '../mocks/test.pdf');

    expect(fs.existsSync(filePath)).toBe(true);

    const response = await request(app)
      .post('/api/upload')
      .attach('contract', filePath);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('extractedText', 'texte simulé');
  }, 10000);
});
