/// <reference lib="webworker" />

import { parseImportPreview } from '../features/import/parse-import-preview';
import {
  importPreviewFailureMessageSchema,
  importPreviewProgressMessageSchema,
  importPreviewRequestMessageSchema,
  importPreviewSuccessMessageSchema,
} from '../schemas/worker/import-preview';

function postProgress(message: { correlationId: string; messageId: string; workspaceVersion: number; phase: 'loading' | 'parsing' | 'normalizing'; messageText: string }) {
  self.postMessage(
    importPreviewProgressMessageSchema.parse({
      schemaVersion: '1.0.0',
      messageId: `${message.messageId}.${message.phase}`,
      correlationId: message.correlationId,
      workspaceVersion: message.workspaceVersion,
      type: 'import.preview.progress',
      payload: {
        phase: message.phase,
        message: message.messageText,
      },
    }),
  );
}

self.onmessage = async (event: MessageEvent) => {
  try {
    const request = importPreviewRequestMessageSchema.parse(event.data);

    postProgress({
      correlationId: request.correlationId,
      messageId: request.messageId,
      workspaceVersion: request.workspaceVersion,
      phase: 'loading',
      messageText: 'Loading the selected source locally.',
    });

    postProgress({
      correlationId: request.correlationId,
      messageId: request.messageId,
      workspaceVersion: request.workspaceVersion,
      phase: 'parsing',
      messageText: 'Parsing rows in the import worker.',
    });

    const preview = await parseImportPreview(request.payload);

    postProgress({
      correlationId: request.correlationId,
      messageId: request.messageId,
      workspaceVersion: request.workspaceVersion,
      phase: 'normalizing',
      messageText: 'Normalizing assumptions and uncertainty for preview.',
    });

    self.postMessage(
      importPreviewSuccessMessageSchema.parse({
        schemaVersion: '1.0.0',
        messageId: `${request.messageId}.success`,
        correlationId: request.correlationId,
        workspaceVersion: request.workspaceVersion,
        type: 'import.preview.success',
        payload: {
          preview,
        },
      }),
    );
  } catch (error) {
    const request = importPreviewRequestMessageSchema.safeParse(event.data);

    self.postMessage(
      importPreviewFailureMessageSchema.parse({
        schemaVersion: '1.0.0',
        messageId: request.success ? `${request.data.messageId}.failure` : 'import.preview.failure',
        correlationId: request.success ? request.data.correlationId : 'import_preview_unknown',
        workspaceVersion: request.success ? request.data.workspaceVersion : 1,
        type: 'import.preview.failure',
        payload: {
          code: 'import.preview.failed',
          title: 'Preview could not be prepared',
          detail: error instanceof Error ? error.message : 'An unknown import preview error occurred.',
          retryable: true,
        },
      }),
    );
  }
};

export {};
