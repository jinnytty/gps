import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

let port = 3000;

if (process.env.PORT) {
  port = Number(process.env.PORT);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(port);
}
bootstrap();
