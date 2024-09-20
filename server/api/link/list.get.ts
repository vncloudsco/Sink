import { z } from 'zod'

export default eventHandler(async (event) => {
  const { cloudflare } = event.context
  const { KV } = cloudflare.env
  
  // Lấy và xác thực query params từ request
  const { limit, cursor } = await getValidatedQuery(event, z.object({
    limit: z.coerce.number().max(1024).default(20),  // Giới hạn số lượng kết quả
    cursor: z.string().trim().max(1024).optional(),  // Con trỏ cho paginated queries
  }).parse)
  
  // Lấy danh sách các key từ KV storage với prefix 'link:'
  const list = await KV.list({
    prefix: `link:`,
    limit,
    cursor,
  })
  
  // Kiểm tra nếu list tồn tại và keys là một mảng
  if (list && Array.isArray(list.keys)) {
    // Tạo danh sách links từ các keys
    list.links = await Promise.all(list.keys.map(async (key: { name: string }) => {
      const { metadata, value: link } = await KV.getWithMetadata(key.name, { type: 'json' })
      if (link) {
        // Nếu link tồn tại, gộp metadata và link vào một đối tượng
        return {
          ...metadata,
          ...link,
        }
      }
      // Nếu link không tồn tại, trả về null hoặc giá trị tương tự
      return null
    }))
    
    // Loại bỏ các giá trị null khỏi danh sách links nếu có
    list.links = list.links.filter(link => link !== null)
  } else {
    // Trường hợp list không hợp lệ hoặc không có keys
    return { error: 'No keys found or invalid list' }
  }
  
  // Xóa thuộc tính keys để không trả về
  delete list.keys
  
  // Trả về danh sách đã được xử lý
  return list
})
