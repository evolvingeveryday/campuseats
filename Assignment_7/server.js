import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { addDish, getDishById, listDishes, waitForDatabase, closeDatabase } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const typeDefs = await readFile(path.join(here, 'schema.graphql'), 'utf8');

const resolvers = {
  Query: {
    dishes: () => listDishes(),
    dish: (_parent, { id }) => getDishById(id)
  },
  Mutation: {
    addDish: async (_parent, { input }) => {
      const name = input.name.trim();
      if (!name) throw new Error('Dish name cannot be empty.');
      if (!Number.isFinite(input.price) || input.price < 0) {
        throw new Error('Price must be a non-negative number.');
      }
      try {
        return await addDish({
          name,
          price: input.price,
          available: input.available ?? true
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw new Error('A dish with this name already exists. Please use a different name.');
        }
        throw error;
      }
    }
  }
};

const apollo = new ApolloServer({ typeDefs, resolvers });
const app = express();
const port = Number(process.env.PORT || 4000);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(here, 'public')));

app.get('/health', async (_req, res) => {
  try {
    await waitForDatabase(1, 0);
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

await waitForDatabase();
await apollo.start();
app.use('/graphql', expressMiddleware(apollo));

const httpServer = app.listen(port, '0.0.0.0', () => {
  console.log('\nCampusEats Dishes GraphQL service is running.');
  console.log(`Web page:     http://localhost:${port}`);
  console.log(`GraphQL API:  http://localhost:${port}/graphql`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log('Press Ctrl+C to stop.\n');
});

async function shutdown() {
  console.log('\nShutting down CampusEats GraphQL service...');
  httpServer.close(async () => {
    await apollo.stop();
    await closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
