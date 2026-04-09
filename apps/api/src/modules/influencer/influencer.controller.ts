import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InfluencerService } from './influencer.service';
import { WatchlistService } from './watchlist.service';
import { BrandService, CreateBrandDto } from './brand.service';

const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

@Controller()
export class InfluencerController {
  private readonly logger = new Logger(InfluencerController.name);

  constructor(
    private readonly influencerService: InfluencerService,
    private readonly watchlistService: WatchlistService,
    private readonly brandService: BrandService,
  ) {}

  // =========================================================================
  // INFLUENCER PROFILES
  // =========================================================================

  @Get('influencers')
  async listInfluencers(
    @Query('search') search?: string,
    @Query('platform') platform?: string,
    @Query('niche') niche?: string,
    @Query('minFollowers') minFollowersStr?: string,
    @Query('maxFollowers') maxFollowersStr?: string,
    @Query('minEngagement') minEngagementStr?: string,
    @Query('maxEngagement') maxEngagementStr?: string,
    @Query('location') location?: string,
    @Query('hasEmail') hasEmailStr?: string,
    @Query('isVerified') isVerifiedStr?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr || '24', 10) || 24));

    try {
      return await this.influencerService.list(DEV_ORG_ID, {
        search,
        platform: platform || undefined,
        niche: niche || undefined,
        minFollowers: minFollowersStr ? parseInt(minFollowersStr, 10) : undefined,
        maxFollowers: maxFollowersStr ? parseInt(maxFollowersStr, 10) : undefined,
        minEngagement: minEngagementStr ? parseFloat(minEngagementStr) : undefined,
        maxEngagement: maxEngagementStr ? parseFloat(maxEngagementStr) : undefined,
        location: location || undefined,
        hasEmail: hasEmailStr === 'true' ? true : undefined,
        isVerified: isVerifiedStr === 'true' ? true : isVerifiedStr === 'false' ? false : undefined,
        sortBy: sortBy || 'score',
        sortOrder: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to list influencers', error);
      throw new HttpException('Failed to load influencers', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('influencers/stats')
  async getInfluencerStats() {
    try {
      return await this.influencerService.getStats(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to get influencer stats', error);
      throw new HttpException('Failed to load influencer stats', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('influencers/:id')
  async getInfluencer(@Param('id') id: string) {
    try {
      return await this.influencerService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get influencer', error);
      throw new HttpException('Failed to load influencer', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // WATCHLISTS
  // =========================================================================

  @Get('watchlists')
  async listWatchlists() {
    try {
      return await this.watchlistService.list(DEV_ORG_ID);
    } catch (error) {
      this.logger.error('Failed to list watchlists', error);
      throw new HttpException('Failed to load watchlists', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('watchlists')
  async createWatchlist(@Body() body: { name: string; description?: string }) {
    try {
      return await this.watchlistService.create(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create watchlist', error);
      throw new HttpException(
        error.message || 'Failed to create watchlist',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('watchlists/:id')
  async getWatchlist(@Param('id') id: string) {
    try {
      return await this.watchlistService.getById(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get watchlist', error);
      throw new HttpException('Failed to load watchlist', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('watchlists/:id')
  async updateWatchlist(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.watchlistService.update(DEV_ORG_ID, id, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to update watchlist', error);
      throw new HttpException('Failed to update watchlist', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('watchlists/:id')
  async deleteWatchlist(@Param('id') id: string) {
    try {
      return await this.watchlistService.delete(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to delete watchlist', error);
      throw new HttpException('Failed to delete watchlist', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('watchlists/:id/items')
  async addWatchlistItem(
    @Param('id') watchlistId: string,
    @Body() body: { influencerProfileId: string; notes?: string },
  ) {
    try {
      return await this.watchlistService.addItem(DEV_ORG_ID, watchlistId, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to add item to watchlist', error);
      throw new HttpException(
        error.message || 'Failed to add to watchlist',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('watchlists/:id/items/:influencerId')
  async removeWatchlistItem(
    @Param('id') watchlistId: string,
    @Param('influencerId') influencerId: string,
  ) {
    try {
      return await this.watchlistService.removeItem(DEV_ORG_ID, watchlistId, influencerId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to remove item from watchlist', error);
      throw new HttpException('Failed to remove from watchlist', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // BRANDS
  // =========================================================================

  @Get('brands/search')
  async searchBrands(@Query('q') query?: string) {
    try {
      return await this.brandService.searchBrands(DEV_ORG_ID, query || '');
    } catch (error) {
      this.logger.error('Failed to search brands', error);
      throw new HttpException('Failed to search brands', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('brands')
  async listBrands(
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    try {
      return await this.brandService.listBrands(DEV_ORG_ID, search || undefined, category || undefined);
    } catch (error) {
      this.logger.error('Failed to list brands', error);
      throw new HttpException('Failed to load brands', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('brands')
  async createBrand(@Body() body: CreateBrandDto) {
    try {
      return await this.brandService.createBrand(DEV_ORG_ID, body);
    } catch (error) {
      this.logger.error('Failed to create brand', error);
      throw new HttpException(
        (error as any).message || 'Failed to create brand',
        (error as any).status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('brands/:id')
  async getBrandDetail(@Param('id') id: string) {
    try {
      return await this.brandService.getBrandDetail(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get brand detail', error);
      throw new HttpException('Failed to load brand', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('brands/:id/influencers')
  async getBrandInfluencers(@Param('id') id: string) {
    try {
      return await this.brandService.getBrandInfluencers(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get brand influencers', error);
      throw new HttpException('Failed to load brand influencers', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('brands/:id/timeline')
  async getBrandTimeline(@Param('id') id: string) {
    try {
      return await this.brandService.getBrandTimeline(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get brand timeline', error);
      throw new HttpException('Failed to load brand timeline', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('brands/:id/competitors')
  async getBrandCompetitors(@Param('id') id: string) {
    try {
      return await this.brandService.getCompetitorOverlap(DEV_ORG_ID, id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to get competitor overlap', error);
      throw new HttpException('Failed to load competitor data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // INFLUENCER BRANDS (on influencer profile)
  // =========================================================================

  @Get('influencers/:id/brands')
  async getInfluencerBrands(@Param('id') id: string) {
    try {
      return await this.brandService.getInfluencerBrands(DEV_ORG_ID, id);
    } catch (error) {
      this.logger.error('Failed to get influencer brands', error);
      throw new HttpException('Failed to load influencer brands', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
