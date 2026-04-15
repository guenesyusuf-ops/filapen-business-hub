import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { WmChatService } from './wm-chat.service';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000099';
const DEV_USER_NAME = 'Dev User';

@Controller('wm/projects/:projectId/chat')
export class WmChatController {
  private readonly logger = new Logger(WmChatController.name);

  constructor(private readonly chatService: WmChatService) {}

  @Get()
  async listMessages(@Param('projectId') projectId: string) {
    try {
      return await this.chatService.listMessages(projectId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('listMessages failed', error);
      throw new HttpException('Failed to list chat messages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post()
  async sendMessage(
    @Param('projectId') projectId: string,
    @Body() body: { message: string },
  ) {
    try {
      return await this.chatService.sendMessage(projectId, {
        userId: DEV_USER_ID,
        userName: DEV_USER_NAME,
        message: body.message,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('sendMessage failed', error);
      throw new HttpException('Failed to send chat message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
