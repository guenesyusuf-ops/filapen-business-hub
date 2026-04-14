import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';

@Controller('uploads')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly storage: StorageService) {}

  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined, // force memory storage for file.buffer
      limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.log(`Upload request: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

    if (!file.buffer) {
      this.logger.error('file.buffer is undefined — Multer memoryStorage not working');
      throw new HttpException('File buffer missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `uploads/${timestamp}-${safeName}`;

      const publicUrl = await this.storage.upload(
        key,
        file.buffer,
        file.mimetype,
      );

      return {
        url: publicUrl,
        key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`R2 upload failed: ${error instanceof Error ? error.message : error}`);
      throw new HttpException(
        `Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
