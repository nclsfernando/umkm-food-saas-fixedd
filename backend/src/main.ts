import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');
  app.enableCors({
    origin: (origin, callback) => {
      const allowed = [
        frontendUrl,
        'https://umkm-food-saas-fixedd.vercel.app',
      ];
      if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UMKM Food API')
    .setDescription('API untuk aplikasi laporan keuangan UMKM food delivery')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Free hosts (Zeabur) inject PORT; bind all interfaces for container networking
  const port = Number(config.get('PORT') || 4000);
  await app.listen(port, '0.0.0.0');

  // Multi-month GrabFood summary imports can take >30s on cold DB
  const server = app.getHttpServer();
  server.setTimeout(5 * 60 * 1000);
  server.headersTimeout = 6 * 60 * 1000;
  server.requestTimeout = 5 * 60 * 1000;
  server.keepAliveTimeout = 65 * 1000;

  console.log(`🚀 Running on http://0.0.0.0:${port}`);
  console.log(`📖 Swagger: http://0.0.0.0:${port}/api/docs`);
}
bootstrap();
