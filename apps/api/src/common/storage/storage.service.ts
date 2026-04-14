import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('R2_BUCKET') || 'filapen-uploads';
    this.publicUrl =
      this.config.get('R2_PUBLIC_URL') ||
      'https://pub-2334f8969b2c4df1bf0eb1d95a1092da.r2.dev';

    const accessKeyId = this.config.get('R2_ACCESS_KEY_ID') || 'e47499ffeab64e344858a071d4ebf510';
    const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY') || 'cd562a1ecc6d25114f9f6f84864bfc19bc4a8b97c42afbb0b913ef366f8d8614';
    const endpoint = this.config.get('R2_ENDPOINT') || 'https://f1722b37e4364e5ab611384fce036e3f.r2.cloudflarestorage.com';

    this.logger.log(`R2 config: bucket=${this.bucket}, endpoint=${endpoint}, keyId=${accessKeyId.slice(0, 8)}...`);

    this.s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    this.logger.log(`Uploading ${key} (${contentType})`);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const url = `${this.publicUrl}/${key}`;
    this.logger.log(`Upload complete: ${url}`);
    return url;
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`Deleting ${key}`);

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
