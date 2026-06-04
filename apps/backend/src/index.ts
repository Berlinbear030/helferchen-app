import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Helferchen API is running');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
