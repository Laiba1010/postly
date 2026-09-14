import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';

import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

import { PostsService } from './posts.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { ReschedulePostDto } from './dto/reschedule-post.dto';

@Controller('workspaces/:workspaceId/posts')
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @Roles(Role.OWNER, Role.EDITOR)
  async create(
    @Param('workspaceId')
    workspaceId: string,

    @Body()
    dto: SaveDraftDto,

    @CurrentUser()
    user: PublicUser,
  ) {
    const post = await this.postsService.createDraft(workspaceId, user.id, dto);

    return { post };
  }

  @Get()
  @Roles(Role.OWNER, Role.EDITOR, Role.VIEWER)
  async list(
    @Param('workspaceId')
    workspaceId: string,
  ) {
    const posts = await this.postsService.listDrafts(workspaceId);

    return { posts };
  }

  @Get(':postId')
  @Roles(Role.OWNER, Role.EDITOR, Role.VIEWER)
  async getOne(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,
  ) {
    const post = await this.postsService.getDraft(workspaceId, postId);

    return { post };
  }

  @Patch(':postId')
  @Roles(Role.OWNER, Role.EDITOR)
  async update(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,

    @Body()
    dto: SaveDraftDto,
  ) {
    const post = await this.postsService.updateDraft(workspaceId, postId, dto);

    return { post };
  }

  @Post(':postId/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER, Role.EDITOR)
  async duplicate(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,

    @CurrentUser()
    user: PublicUser,
  ) {
    const post = await this.postsService.duplicateDraft(
      workspaceId,
      user.id,
      postId,
    );

    return { post };
  }

  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.EDITOR)
  async remove(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,
  ) {
    await this.postsService.deleteDraft(workspaceId, postId);

    return {
      success: true,
    };
  }

  @Post(':postId/schedule')
  @Roles(Role.OWNER, Role.EDITOR)
  async schedule(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,

    @Body()
    dto: SchedulePostDto,
  ) {
    const post = await this.postsService.scheduleDraft(
      workspaceId,
      postId,
      dto,
    );

    return { post };
  }

  @Patch(':postId/schedule')
  @Roles(Role.OWNER, Role.EDITOR)
  async reschedule(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,

    @Body()
    dto: ReschedulePostDto,
  ) {
    const post = await this.postsService.reschedulePost(
      workspaceId,
      postId,
      dto,
    );

    return { post };
  }

  @Post(':postId/cancel')
  @Roles(Role.OWNER, Role.EDITOR)
  async cancel(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,
  ) {
    const post = await this.postsService.cancelSchedule(workspaceId, postId);

    return { post };
  }

  /**
   * Manual retry is an operational mutation.
   *
   * VIEWER is intentionally excluded.
   */
  @Post(':postId/targets/:targetId/retry')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.EDITOR)
  async retryTarget(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,

    @Param('targetId')
    targetId: string,
  ) {
    const target = await this.postsService.retryTarget(
      workspaceId,
      postId,
      targetId,
    );

    return { target };
  }

  @Get(':postId/targets')
  @Roles(Role.OWNER, Role.EDITOR, Role.VIEWER)
  async targets(
    @Param('workspaceId')
    workspaceId: string,

    @Param('postId')
    postId: string,
  ) {
    const targets = await this.postsService.listTargetsForPost(
      workspaceId,
      postId,
    );

    return { targets };
  }
  @Get(':postId/status')
  @Roles(Role.OWNER, Role.EDITOR, Role.VIEWER)
  async status(
    @Param('workspaceId') workspaceId: string,
    @Param('postId') postId: string,
  ) {
    const status = await this.postsService.getPostStatus(workspaceId, postId);
    return status;
  }
}
