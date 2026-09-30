export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

async function compressImage(file: File, maxBytes: number): Promise<File | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)
      try {
        let { width, height } = img
        const maxDimension = 3840
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const isPng = file.type === 'image/png'
        const mimeType = isPng ? 'image/png' : 'image/jpeg'
        const extension = isPng ? '.png' : '.jpg'
        const newName = file.name.replace(/\.[^.]+$/, '') + extension

        const qualities = isPng ? [undefined] : [0.92, 0.85, 0.75, 0.65]

        for (const quality of qualities) {
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, mimeType, quality))
          if (blob && blob.size <= maxBytes) {
            resolve(new File([blob], newName, { type: mimeType, lastModified: Date.now() }))
            return
          }
        }

        if (isPng) {
          for (const quality of [0.9, 0.8, 0.7]) {
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
            if (blob && blob.size <= maxBytes) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
              return
            }
          }
        }

        resolve(null)
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }

    img.src = url
  })
}

export async function prepareImageForUpload(
  file: File,
  maxBytes: number = MAX_IMAGE_SIZE_BYTES
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Поддерживаются только изображения (JPEG, PNG, WebP)')
  }

  if (file.size <= maxBytes) {
    return file
  }

  try {
    const compressed = await compressImage(file, maxBytes)
    if (compressed && compressed.size <= maxBytes) {
      return compressed
    }
  } catch {
    // If canvas compression is unavailable, fall through
  }

  const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
  throw new Error(`Размер файла (${sizeMb} МБ) превышает лимит 10 МБ. Выберите файл меньшего размера.`)
}
