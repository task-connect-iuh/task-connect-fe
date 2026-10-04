// Bo emoji dung chung cho ca 2 noi: nut emoji trong o soan tin (chen vao noi dung) va tha bieu
// tuong cam xuc tren 1 tin nhan (them 2026-09-26). Danh sach co dinh, khong goi thu vien ngoai
// (emoji-mart/emoji-picker-react...) de tranh phai xin them dependency moi (xem
// .claude/rules/02-source-of-truth.md - "Them thu vien" bat buoc hoi truoc) - 32 emoji pho bien
// nhat kieu Messenger/Zalo la du cho nhu cau 1 app chat 2 nguoi cua do an nay.
export const COMMON_EMOJIS: string[] = [
  '😀', '😁', '😂', '🤣', '😊', '🙂', '😉', '😍',
  '😘', '😜', '🤔', '😐', '😴', '😢', '😭', '😡',
  '👍', '👎', '👏', '🙏', '💪', '❤️', '🔥', '🎉',
  '✅', '❌', '⚠️', '💯', '🙌', '🤝', '👀', '🥳',
]

// Reaction nhanh hien san (khong can mo bang day du COMMON_EMOJIS) - giong hang reaction nhanh
// cua Messenger/Zalo.
export const QUICK_REACTIONS: string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏']
