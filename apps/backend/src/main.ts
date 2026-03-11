import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
  const configuredOrigins = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_PUBLIC_URL,
    'http://localhost',
    'http://localhost:5173',
  ].filter((value): value is string => Boolean(value && value.trim()));

  const allowedOrigins = Array.from(new Set(configuredOrigins.map((value) => value.replace(/\/$/, ''))));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalized)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
  });

  const port = Number(process.env.BACKEND_PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
