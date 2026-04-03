import type { ManagedAttachmentRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { appApi } from '@/api/client'
import { getErrorMessage } from '@/utils/error'

type SelectedFile = {
  filePath: string
  size: number
  fileName: string
  contentType: string
}

type UploadResult = ManagedAttachmentRecord

const imageExtToMimeTypeMap: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
}

const inferMimeType = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase()
  const ext = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.')) : ''
  return imageExtToMimeTypeMap[ext] || 'image/jpeg'
}

const parseFileName = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/')
  const maybeName = normalized.slice(normalized.lastIndexOf('/') + 1).trim()
  return maybeName || `attachment-${Date.now()}.jpg`
}

const normalizeSelectedFiles = (result: any): SelectedFile[] => {
  const tempFiles = Array.isArray(result?.tempFiles) ? result.tempFiles : []
  const tempFilePaths = Array.isArray(result?.tempFilePaths) ? result.tempFilePaths : []

  const fromTempFiles = tempFiles
    .map((item: any) => {
      const filePath = item?.tempFilePath || item?.path || ''
      const size = Number(item?.size || 0)
      if (!filePath || !size) {
        return null
      }

      const fileName = String(item?.name || parseFileName(filePath))
      return {
        filePath,
        size,
        fileName,
        contentType: String(item?.type || inferMimeType(fileName)),
      } satisfies SelectedFile
    })
    .filter((item: SelectedFile | null): item is SelectedFile => Boolean(item))

  if (fromTempFiles.length > 0) {
    return fromTempFiles
  }

  return tempFilePaths.map((filePath: string) => {
    const fileName = parseFileName(filePath)
    return {
      filePath,
      size: 0,
      fileName,
      contentType: inferMimeType(fileName),
    } satisfies SelectedFile
  })
}

const chooseImageFiles = (count: number) => new Promise<SelectedFile[]>((resolve, reject) => {
  const handleSuccess = (result: any) => {
    const selected = normalizeSelectedFiles(result)
    if (!selected.length) {
      reject(new Error('无法解析所选图片，请重试'))
      return
    }
    resolve(selected)
  }

  // #ifdef MP-WEIXIN
  uni.chooseMedia({
    count,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    success: handleSuccess,
    fail: reject,
  })
  // #endif

  // #ifndef MP-WEIXIN
  uni.chooseImage({
    count,
    sourceType: ['album', 'camera'],
    success: handleSuccess,
    fail: reject,
  })
  // #endif
})

const uploadPartByUni = async (
  part: {
    url: string
    fields: Record<string, string>
  },
  filePath: string,
) => {
  await new Promise<void>((resolve, reject) => {
    uni.uploadFile({
      url: part.url,
      filePath,
      name: 'file',
      formData: part.fields,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
          return
        }
        reject(new Error(`上传文件失败，状态码 ${res.statusCode}`))
      },
      fail: reject,
    })
  })
}

export function useManagedAttachmentUpload(options?: {
  maxCount?: number
  maxSizeMb?: number
}) {
  const uploading = ref(false)
  const maxCount = options?.maxCount ?? 3
  const maxSizeBytes = (options?.maxSizeMb ?? 8) * 1024 * 1024

  const selectAndUploadAttachments = async (payload: {
    tag1?: string
    tag2?: string
    maxCount?: number
  }): Promise<UploadResult[]> => {
    const allowedCount = payload.maxCount && payload.maxCount > 0 ? payload.maxCount : maxCount
    if (allowedCount <= 0) {
      throw new Error('当前没有可用的上传名额')
    }

    const selected = await chooseImageFiles(allowedCount)
    const normalized = selected.filter(item => item.size <= maxSizeBytes)

    if (!normalized.length) {
      throw new Error(`图片大小不能超过 ${Math.round(maxSizeBytes / 1024 / 1024)}MB`)
    }

    uploading.value = true
    try {
      const uploadedResults: UploadResult[] = []

      for (const item of normalized) {
        const plan = await appApi.files.prepareUpload({
          kind: 'attachment',
          fileName: item.fileName,
          contentType: item.contentType,
          size: item.size,
          tag1: payload.tag1,
          tag2: payload.tag2,
        })

        if (plan.parts.length !== 1) {
          throw new Error('当前仅支持上传单张图片，请压缩后重试')
        }

        await uploadPartByUni(plan.parts[0], item.filePath)
        const completed = await appApi.files.completeUpload({ fileId: plan.fileId })
        uploadedResults.push({
          fileId: completed.fileId,
          url: completed.url,
          name: item.fileName,
          mimeType: item.contentType,
          size: item.size,
          uploadedAt: new Date().toISOString(),
        })
      }

      return uploadedResults
    }
    catch (error: unknown) {
      throw new Error(getErrorMessage(error, '上传附件失败'))
    }
    finally {
      uploading.value = false
    }
  }

  return {
    uploading,
    selectAndUploadAttachments,
  }
}
