import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  Scale, 
  Search, 
  Copy, 
  Check, 
  AlertTriangle, 
  Flame,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useLanguage, pickLang } from '../context/LanguageContext';

export interface RuleClause {
  id: string;
  ruleNumber: string; // "Luật 1" or "Rule 1"
  title: string;
  category: 'all' | 'speech' | 'file' | 'system' | 'sanctions' | 'dev';
  severity: 'low' | 'medium' | 'high' | 'critical';
  severityLabel: string;
  description: string;
  actions: string[];
  penalties: string[];
}

// ==================== BẢNG LUẬT TIẾNG VIỆT ====================
export const COMMUNITY_RULES_VI: RuleClause[] = [
  // --- NHÓM NGÔN TỪ & GIAO TIẾP ---
  {
    id: '1',
    ruleNumber: 'Luật 1',
    title: 'Xúc phạm danh dự & Lăng mạ cá nhân',
    category: 'speech',
    severity: 'medium',
    severityLabel: 'Mức độ: Vừa',
    description: 'Nghiêm cấm mọi hành vi sử dụng từ ngữ thô tục, hạ nhục, chửi bới, miệt thị danh dự, nhân phẩm của cá nhân, gia đình hoặc tập thể người dùng khác.',
    actions: [
      'Chửi bới thô bạo bằng danh từ bộ phận sinh dục hoặc từ ngữ tục tĩu.',
      'Nhục mạ ngoại hình, hoàn cảnh, gia đình của người khác.',
      'Đe dọa dùng bạo lực hoặc khủng bố tinh thần trong phòng chat.'
    ],
    penalties: [
      'Cảnh cáo lần 1: Hệ thống tự động che chắn ***.',
      'Tái phạm: Khóa quyền gửi tin nhắn trong 24 giờ.'
    ]
  },
  {
    id: '2',
    ruleNumber: 'Luật 2',
    title: 'Cố tình lách luật & Ngụy trang từ ngữ tục tĩu',
    category: 'speech',
    severity: 'medium',
    severityLabel: 'Mức độ: Vừa',
    description: 'Nghiêm cấm hành vi cố ý chèn dấu chấm, dấu gạch, khoảng trắng, số thay chữ hoặc teencode nhằm vượt qua hệ thống kiểm duyệt tự động.',
    actions: [
      'Cố tình viết dạng ngắt âm: f.u.c.k, d.i.t, d_i_t, s e x, l.o.n, c.a.c.',
      'Viết teencode, tiếng lóng tục tĩu: djt, vcl, dkm, cailon, con cac, dau buoi.',
      'Dùng số thay chữ: d1t, s3x, đ3o.'
    ],
    penalties: [
      'Hệ thống tự động phát hiện, thay thế bằng *** và ghi nhận vi phạm.',
      'Nếu cố ý spam từ lách luật nhiều lần: Tạm khóa tài khoản từ 1 đến 12 giờ.'
    ]
  },
  {
    id: '3',
    ruleNumber: 'Luật 3',
    title: 'Kỳ thị vùng miền, tôn giáo & Kích động thù hận',
    category: 'speech',
    severity: 'high',
    severityLabel: 'Mức độ: Cao',
    description: 'Tuyệt đối tuân thủ Luật An ninh mạng: Nghiêm cấm mọi phát ngôn mang tính chia rẽ vùng miền, xúc phạm tôn giáo, tín ngưỡng, sắc tộc, giới tính hoặc kích động bạo lực.',
    actions: [
      'Dùng từ ngữ miệt thị văn hóa vùng miền (Bắc/Trung/Nam).',
      'Xúc phạm tín ngưỡng tôn giáo, phân biệt chủng tộc, giới tính.',
      'Tuyên truyền thông tin xuyên tạc, kích động tụ tập bạo lực.'
    ],
    penalties: [
      'Khóa tài khoản và quyền truy cập từ 3 đến 7 ngày.',
      'Cấm vĩnh viễn đối với hành vi tuyên truyền kích động nghiêm trọng.'
    ]
  },
  {
    id: '4',
    ruleNumber: 'Luật 4',
    title: 'Quấy rối tình dục & Gạ gẫm thô thiển',
    category: 'speech',
    severity: 'high',
    severityLabel: 'Mức độ: Cao',
    description: 'Nghiêm cấm gửi tin nhắn gạ tình thô thiển, quấy rối tình dục hoặc ép buộc người khác tiếp nhận các nội dung nhạy cảm.',
    actions: [
      'Nhắn tin gạ gẫm, đòi hỏi hình ảnh riêng tư nhạy cảm của người khác.',
      'Bình luận khiếm nhã, thô bỉ về cơ thể của thành viên trong phòng.',
      'Cố tình theo đuổi, spam tin nhắn sau khi đối phương đã từ chối.'
    ],
    penalties: [
      'Ngắt kết nối P2P lập tức giữa hai thiết bị.',
      'Khóa quyền tham gia các phòng chat công cộng trong 48 giờ.'
    ]
  },

  // --- NHÓM TỆP TIN & HÌNH ẢNH ---
  {
    id: '5',
    ruleNumber: 'Luật 5',
    title: 'Phát tán văn hóa phẩm đồi trụy, 18+ & Khiêu dâm',
    category: 'file',
    severity: 'critical',
    severityLabel: 'Mức độ: Nghiêm trọng',
    description: 'Căn cứ Luật An ninh mạng Việt Nam và Luật Quốc tế: Nghiêm cấm TUYỆT ĐỐI việc gửi, lưu trữ hoặc truyền tải hình ảnh, video khiêu dâm, đồi trụy hoặc lạm dụng tình dục trẻ em (CSAM).',
    actions: [
      'Gửi hình ảnh, video lộ bộ phận nhạy cảm, khỏa thân 18+.',
      'Truyền tải các tệp phim ảnh khiêu dâm, văn hóa phẩm đồi trụy.',
      'Bất kỳ hành vi nào liên quan đến hình ảnh bóc lột, xâm hại trẻ em.'
    ],
    penalties: [
      'MỨC PHẠT CAO NHẤT: Khóa vĩnh viễn UID thiết bị, hủy mã PIN.',
      'Đưa địa chỉ IP vào danh sách đen (Blacklist) vĩnh viễn và lưu vết để báo cáo pháp luật.'
    ]
  },
  {
    id: '6',
    ruleNumber: 'Luật 6',
    title: 'Hình ảnh bạo lực cực đoan, kinh dị & Tự hại',
    category: 'file',
    severity: 'critical',
    severityLabel: 'Mức độ: Nghiêm trọng',
    description: 'Nghiêm cấm chia sẻ hình ảnh máu me rùng rợn, tai nạn ghê rợn, hành vi tra tấn thể xác, tự sát, tự gây thương tích hoặc hướng dẫn chế tạo vũ khí.',
    actions: [
      'Chia sẻ ảnh thi thể, vết thương kinh dị không mang tính chất y khoa.',
      'Cổ súy hoặc chia sẻ hình ảnh/video tự làm hại bản thân, tự sát.',
      'Phát tán tài liệu hướng dẫn khủng bố, chế tạo vũ khí, chất nổ nguy hiểm.'
    ],
    penalties: [
      'Hệ thống AI tự động chặn và xóa tệp trước khi truyền đi.',
      'Đình chỉ tài khoản từ 7 ngày đến khóa vĩnh viễn.'
    ]
  },
  {
    id: '7',
    ruleNumber: 'Luật 7',
    title: 'Phát tán virus, mã độc & Đường dẫn lừa đảo (Phishing)',
    category: 'file',
    severity: 'critical',
    severityLabel: 'Mức độ: Nghiêm trọng',
    description: 'Nghiêm cấm truyền tệp chứa mã độc (Malware, Trojan, Ransomware, Keylogger, Zip Bomb) hoặc gửi liên kết lừa đảo nhằm chiếm đoạt dữ liệu, tài khoản của người khác.',
    actions: [
      'Gửi tệp thực thi .exe/.bat/.scr giả mạo ứng dụng hợp pháp.',
      'Gửi tệp zip bomb hoặc tệp lỗi nhằm làm treo đơ máy người nhận.',
      'Gửi đường link lừa đảo mạo danh ngân hàng, mạng xã hội để hack mật khẩu.'
    ],
    penalties: [
      'Khóa tài khoản vĩnh viễn lập tức.',
      'Chặn hàm băm (hash) của tệp trên toàn bộ hệ sinh thái dịch vụ.'
    ]
  },
  {
    id: '8',
    ruleNumber: 'Luật 8',
    title: 'Xâm phạm dữ liệu cá nhân & Bí mật đời tư (Doxxing)',
    category: 'file',
    severity: 'high',
    severityLabel: 'Mức độ: Cao',
    description: 'Nghiêm cấm tiết lộ thông tin định danh cá nhân của người khác mà chưa có sự đồng ý hợp pháp của họ.',
    actions: [
      'Đăng tải ảnh CCCD/CMND, hộ chiếu của người khác lên phòng chat.',
      'Công khai số điện thoại, địa chỉ nhà ở, tài khoản ngân hàng để kêu gọi phá hoại.',
      'Phát tán tài liệu nội bộ, thông tin mật cá nhân.'
    ],
    penalties: [
      'Xóa bỏ toàn bộ nội dung vi phạm ngay lập tức.',
      'Khóa tính năng chuyển tệp và nhắn tin từ 3 đến 14 ngày.'
    ]
  },

  // --- NHÓM HỆ THỐNG & PHÒNG CHAT ---
  {
    id: '9',
    ruleNumber: 'Luật 9',
    title: 'Spam tin nhắn & Phá hoại băng thông hệ thống',
    category: 'system',
    severity: 'medium',
    severityLabel: 'Mức độ: Vừa',
    description: 'Nghiêm cấm hành vi gửi tin nhắn dồn dập, dùng script tự động spam file rác làm nghẽn kênh truyền P2P/Relay của các người dùng khác.',
    actions: [
      'Gửi liên tiếp hàng chục tin nhắn giống nhau trong thời gian ngắn.',
      'Cố tình gửi liên tục nhiều file dung lượng lớn không có sự đồng ý của phòng.',
      'Sử dụng công cụ tự động bot treo làm quá tải phòng trò chuyện.'
    ],
    penalties: [
      'Kích hoạt giới hạn tần suất (Rate Limit), tạm khóa gửi tin 30 - 60 phút.',
      'Chủ phòng có quyền kick ra khỏi phòng ngay lập tức.'
    ]
  },
  {
    id: '10',
    ruleNumber: 'Luật 10',
    title: 'Mạo danh Quản trị viên (Admin/Dev) & Lừa đảo',
    category: 'system',
    severity: 'high',
    severityLabel: 'Mức độ: Cao',
    description: 'Nghiêm cấm đặt tên thiết bị, tên hiển thị hoặc mạo nhận là Quản trị viên, Đội ngũ kỹ thuật của CloudSend nhằm mục đích trục lợi hoặc đe dọa người dùng.',
    actions: [
      'Đặt tên "Hệ thống", "Admin", "Ban Quản Trị" để yêu cầu người khác cung cấp mã PIN.',
      'Giả danh lập trình viên để xin dữ liệu riêng tư hoặc lừa tiền.',
      'Tạo phòng chat giả mạo thông báo trúng thưởng lừa đảo.'
    ],
    penalties: [
      'Thu hồi tên hiển thị, khóa vĩnh viễn tài khoản giả mạo.',
      'Đưa vào danh sách cảnh báo lừa đảo toàn hệ thống.'
    ]
  },
  {
    id: '11',
    ruleNumber: 'Luật 11',
    title: 'Quyền hạn & Trách nhiệm của Chủ phòng chat',
    category: 'system',
    severity: 'low',
    severityLabel: 'Mức độ: Nhẹ',
    description: 'Chủ phòng chat có trách nhiệm quản lý trật tự trong phòng và có quyền xử lý các thành viên vi phạm theo nội quy chung.',
    actions: [
      'Chủ phòng có quyền xóa các tin nhắn vi phạm chuẩn mực văn hóa.',
      'Chủ phòng có quyền Kick (mời ra) những thành viên cố tình spam, gây rối.',
      'Đổi mã bảo mật phòng khi có người lạ xâm nhập quấy phá.'
    ],
    penalties: [
      'Nếu chủ phòng cố ý dung túng cho các hành vi 18+ (Luật 5) hoặc phát tán mã độc (Luật 7), cả phòng sẽ bị xóa và chủ phòng bị xử lý liên đới.'
    ]
  },

  // --- KHUNG XỬ PHẠT CHUNG ---
  {
    id: '12',
    ruleNumber: 'Luật 12',
    title: 'Quy trình xử lý vi phạm & Kháng cáo',
    category: 'sanctions',
    severity: 'low',
    severityLabel: 'Mức độ: Quy định chung',
    description: 'Hệ thống áp dụng các mức chế tài từ nhẹ đến nghiêm trọng dựa trên mức độ ảnh hưởng của hành vi vi phạm.',
    actions: [
      'Mức 1 (Cảnh cáo): Nhắc nhở trực tiếp, hệ thống tự động ẩn hoặc che chắn ***.',
      'Mức 2 (Đình chỉ có thời hạn): Khóa quyền gửi tin/file từ 1 giờ đến 7 ngày.',
      'Mức 3 (Đình chỉ vĩnh viễn): Khóa UID thiết bị và cấm IP truy cập vĩnh viễn.'
    ],
    penalties: [
      'Người dùng bị khóa có thể gửi phản hồi cho Quản trị viên kèm bằng chứng để được xem xét gỡ chặn nếu vi phạm do nhầm lẫn.'
    ]
  },
  {
    id: '13',
    ruleNumber: 'Luật 13',
    title: 'Bảo vệ Dữ liệu Cá nhân (NĐ 13/2023/NĐ-CP VN & GDPR/CCPA Quốc tế)',
    category: 'system',
    severity: 'high',
    severityLabel: 'Mức độ: Pháp luật Dữ liệu',
    description: 'Tuân thủ chọn lọc Nghị định 13/2023/NĐ-CP Việt Nam, Luật An ninh mạng cùng GDPR & CCPA quốc tế: Mọi dữ liệu người dùng (Email, SĐT OTP, hồ sơ Google/Facebook/GitHub, tệp Cloud) được thu thập tối thiểu theo sự đồng ý rõ ràng và nghiêm cấm tuyệt đối hành vi thu thập ngầm hay rao bán dữ liệu.',
    actions: [
      'Cấm chạy công cụ quét trộm (Crawler/Scraper) thu thập Email, SĐT, UID hoặc hồ sơ người dùng khác.',
      'Cấm mua bán, trao đổi thông tin tài khoản hoặc ép buộc người dùng cung cấp dữ liệu nhạy cảm.',
      'Người dùng có toàn quyền xem, chỉnh sửa, rút lại đồng ý và xóa dữ liệu Cloud/phiên đăng nhập bất kỳ lúc nào (Right to Erasure).'
    ],
    penalties: [
      'Khóa vĩnh viễn tài khoản/IP vi phạm quyền bảo vệ dữ liệu cá nhân.',
      'Thông báo sự cố dữ liệu trong 72h và hỗ trợ xóa dữ liệu cá nhân theo yêu cầu hợp lệ.'
    ]
  },

  // --- NHÓM LUẬT DÀNH CHO DEV & QUẢN TRỊ VIÊN ---
  {
    id: '14',
    ruleNumber: 'Luật 14',
    title: 'Giới Hạn Quyền Lực & Cấm Lạm Quyền Dành Cho DEV / Admin',
    category: 'dev',
    severity: 'high',
    severityLabel: 'Mức độ: Ràng buộc DEV',
    description: 'Người dùng có nội quy thì DEV và Quản trị viên cũng phải chịu luật nghiêm ngặt: Chỉ được khóa/hạn chế tài khoản (Ban thủ công) khi có vi phạm thực tế đối chiếu đúng điều khoản hoặc mối đe dọa an ninh khẩn cấp.',
    actions: [
      'Nghiêm cấm Ban người dùng theo cảm tính, mâu thuẫn cá nhân hoặc trả thù riêng.',
      'Mọi thao tác Ban/Mở khóa (Unban) trong Datastore đều phải ghi nhận lý do minh bạch.',
      'Tài khoản DEV khi giao tiếp cộng đồng vẫn phải giữ chuẩn mực văn minh và không dùng huy hiệu DEV để đe dọa hay trục lợi.'
    ],
    penalties: [
      'Mọi lệnh khóa tài khoản sai quy định phải được thu hồi và mở khóa ngay lập tức.',
      'Cá nhân lạm quyền bị tước bỏ quyền hạn DEV/Quản trị viên khỏi hệ thống.'
    ]
  },
  {
    id: '15',
    ruleNumber: 'Luật 15',
    title: 'Bảo Mật Dữ Liệu (Zero Snooping) & Trách Nhiệm Sửa Sai Của DEV',
    category: 'dev',
    severity: 'critical',
    severityLabel: 'Mức độ: Đạo đức & Pháp lý DEV',
    description: 'DEV bị nghiêm cấm lợi dụng quyền truy cập kỹ thuật để xem trộm, sao chép hoặc phát tán tệp tin, tin nhắn riêng tư và dữ liệu cá nhân (Email, SĐT, ngày sinh) của người dùng; đồng thời có trách nhiệm rà soát kháng cáo công tâm.',
    actions: [
      'Cấm tự ý đọc trộm nội dung riêng tư hoặc trích xuất thông tin người dùng ngoài phạm vi sửa lỗi kỹ thuật hợp lệ.',
      'Phải tiếp nhận và kiểm tra lại các trường hợp bị AI hoặc DEV khóa nhầm trong vòng 24 - 48 giờ làm việc.',
      'Mở khóa (Unban) ngay lập tức và xóa điểm vi phạm oan nếu xác minh là xử lý nhầm.'
    ],
    penalties: [
      'Thu hồi vĩnh viễn quyền truy cập Datastore đối với bất kỳ hành vi xâm phạm riêng tư nào.',
      'Bắt buộc khắc phục lỗi kiểm duyệt và khôi phục đầy đủ quyền lợi cho người dùng bị ảnh hưởng.'
    ]
  }
];

// ==================== ENGLISH COMMUNITY RULES ====================
export const COMMUNITY_RULES_EN: RuleClause[] = [
  // --- LANGUAGE & COMMUNICATION ---
  {
    id: '1',
    ruleNumber: 'Rule 1',
    title: 'Defamation & Personal Insults',
    category: 'speech',
    severity: 'medium',
    severityLabel: 'Severity: Medium',
    description: 'Strictly prohibits all forms of abusive language, humiliation, verbal abuse, and attacks on the personal honor, dignity, or families of other users.',
    actions: [
      'Direct profanity, obscene insults, or vulgar anatomical slurs.',
      'Belittling appearance, personal background, race, or family of other members.',
      'Threatening physical harm or psychological intimidation in chat rooms.'
    ],
    penalties: [
      'First Warning: System automatically masks offensive words with ***.',
      'Repeat Offense: Messaging privileges suspended for 24 hours.'
    ]
  },
  {
    id: '2',
    ruleNumber: 'Rule 2',
    title: 'Intentional Filter Evasion & Camouflaged Profanity',
    category: 'speech',
    severity: 'medium',
    severityLabel: 'Severity: Medium',
    description: 'Strictly prohibits intentionally inserting periods, hyphens, spaces, numbers, or leetspeak/teencode to bypass automated content filters.',
    actions: [
      'Intentionally breaking words: f.u.c.k, s-e-x, b_i_t_c_h, etc.',
      'Using disguised leetspeak or obscure vulgar slang.',
      'Substituting numbers for letters: sh1t, d1ck, etc.'
    ],
    penalties: [
      'System automatically detects, masks with ***, and records the infraction.',
      'Repeated intentional filter evasion: Account suspended for 1 to 12 hours.'
    ]
  },
  {
    id: '3',
    ruleNumber: 'Rule 3',
    title: 'Discrimination, Hate Speech & Incitement to Violence',
    category: 'speech',
    severity: 'high',
    severityLabel: 'Severity: High',
    description: 'Strict compliance with cybersecurity laws: Absolutely prohibits hate speech dividing regions, insulting religions, beliefs, ethnicities, genders, or inciting violence.',
    actions: [
      'Using derogatory slurs against regional cultures, races, or nationalities.',
      'Insulting religious beliefs, racial backgrounds, or gender identities.',
      'Spreading fabricated disinformation, propaganda, or inciting violent gatherings.'
    ],
    penalties: [
      'Account suspension and access revocation for 3 to 7 days.',
      'Permanent ban for severe cases of incitement or hate propaganda.'
    ]
  },
  {
    id: '4',
    ruleNumber: 'Rule 4',
    title: 'Sexual Harassment & Crude Solicitation',
    category: 'speech',
    severity: 'high',
    severityLabel: 'Severity: High',
    description: 'Strictly prohibits sending crude sexual advances, sexually harassing others, or forcing non-consenting users to receive explicit content.',
    actions: [
      'Demanding private, explicit, or intimate photos from other members.',
      'Making lewd, vulgar, or uninvited sexual comments about members\' bodies.',
      'Persistently pursuing, stalking, or spamming messages after being asked to stop.'
    ],
    penalties: [
      'Immediate termination of P2P connection between the two devices.',
      '48-hour ban from participating in all public chat rooms.'
    ]
  },

  // --- FILES & MEDIA ---
  {
    id: '5',
    ruleNumber: 'Rule 5',
    title: 'Distribution of Obscene, 18+ & Pornographic Media',
    category: 'file',
    severity: 'critical',
    severityLabel: 'Severity: Critical',
    description: 'Pursuant to national cybersecurity laws and international regulations: ABSOLUTELY PROHIBITED to upload, transmit, or share pornographic, explicit, obscene media, or Child Sexual Abuse Material (CSAM).',
    actions: [
      'Sending explicit images, nudity, or 18+ pornographic videos.',
      'Distributing pornographic media collections or obscene adult content.',
      'Any action or content related to child sexual exploitation and abuse.'
    ],
    penalties: [
      'HIGHEST PENALTY: Permanent device UID ban and PIN invalidation.',
      'Permanent IP blacklisting and logging of evidence for law enforcement referral.'
    ]
  },
  {
    id: '6',
    ruleNumber: 'Rule 6',
    title: 'Extreme Violence, Gore & Self-Harm Content',
    category: 'file',
    severity: 'critical',
    severityLabel: 'Severity: Critical',
    description: 'Prohibits sharing grotesque bloody imagery, gruesome accident scenes, physical torture, suicide, self-injury, or weapons manufacturing guides.',
    actions: [
      'Sharing disturbing photos of bodies or graphic trauma without medical context.',
      'Promoting, glorifying, or distributing suicide or self-harm content.',
      'Distributing guides or instructions on terrorism, explosives, or illegal weapons.'
    ],
    penalties: [
      'AI moderation automatically blocks and deletes files before transmission.',
      'Account suspension ranging from 7 days up to a permanent ban.'
    ]
  },
  {
    id: '7',
    ruleNumber: 'Rule 7',
    title: 'Distribution of Malware, Viruses & Phishing Links',
    category: 'file',
    severity: 'critical',
    severityLabel: 'Severity: Critical',
    description: 'Prohibits transmitting malicious files (Malware, Trojan, Ransomware, Keylogger, Zip Bomb) or phishing links intended to hijack data or steal user accounts.',
    actions: [
      'Sending executable .exe/.bat/.scr disguised as legitimate software.',
      'Sending decompression zip bombs or corrupted files designed to crash devices.',
      'Distributing fake login or phishing links impersonating banks or social networks.'
    ],
    penalties: [
      'Immediate permanent account and device ban.',
      'File SHA-256 hash blocked globally across the entire cloud network.'
    ]
  },
  {
    id: '8',
    ruleNumber: 'Rule 8',
    title: 'Privacy Violation & Doxxing (Personal Data Exposure)',
    category: 'file',
    severity: 'high',
    severityLabel: 'Severity: High',
    description: 'Strictly prohibits publicly releasing or leaking personal identifiable information of others without explicit lawful consent.',
    actions: [
      'Posting national ID cards, passports, or private documents to chat rooms.',
      'Doxxing phone numbers, home addresses, or bank accounts for harassment.',
      'Leaking confidential personal or organizational records.'
    ],
    penalties: [
      'Immediate deletion and scrub of all offending content.',
      'File transfer and messaging features locked for 3 to 14 days.'
    ]
  },

  // --- SYSTEM & CHAT ROOMS ---
  {
    id: '9',
    ruleNumber: 'Rule 9',
    title: 'Message Spam & System Bandwidth Abuse',
    category: 'system',
    severity: 'medium',
    severityLabel: 'Severity: Medium',
    description: 'Prohibits rapid message spamming, automated scripts flooding junk files, or deliberately clogging P2P/Relay channels for other users.',
    actions: [
      'Rapidly sending dozens of identical or senseless messages in a short period.',
      'Repeatedly blasting heavy files without agreement from room members.',
      'Using automated bots or stress-testing scripts that overload chat rooms.'
    ],
    penalties: [
      'Rate limiting activated; messaging temporarily suspended for 30–60 minutes.',
      'Room owners have the right to immediately kick the disruptive user.'
    ]
  },
  {
    id: '10',
    ruleNumber: 'Rule 10',
    title: 'Impersonating Administrators (Admin/Dev) & Fraud',
    category: 'system',
    severity: 'high',
    severityLabel: 'Severity: High',
    description: 'Prohibits naming devices, display profiles, or claiming to be CloudSend Administrators or Technical Staff to extort data, money, or intimidate users.',
    actions: [
      'Using names like "System", "Admin", "Moderator" to demand PINs or credentials.',
      'Posing as developers to solicit private information or money.',
      'Creating fraudulent rooms announcing fake rewards or lotteries.'
    ],
    penalties: [
      'Display name revoked; fraudulent account permanently terminated.',
      'Placed on the network-wide fraud warning registry.'
    ]
  },
  {
    id: '11',
    ruleNumber: 'Rule 11',
    title: 'Room Owner Authority & Responsibilities',
    category: 'system',
    severity: 'low',
    severityLabel: 'Severity: General Policy',
    description: 'Room owners have the responsibility to preserve order and have full authority to moderate members violating community standards.',
    actions: [
      'Room owners have the authority to delete messages violating standards.',
      'Room owners have the authority to kick members who persistently spam or cause trouble.',
      'Room owners may rotate security keys/passwords if unauthorized intruders enter.'
    ],
    penalties: [
      'If a room owner knowingly tolerates CSAM/18+ (Rule 5) or malware (Rule 7), the entire room will be dissolved and the owner held jointly liable.'
    ]
  },

  // --- GENERAL SANCTIONS & APPEALS ---
  {
    id: '12',
    ruleNumber: 'Rule 12',
    title: 'Enforcement Procedure & Appeals Process',
    category: 'sanctions',
    severity: 'low',
    severityLabel: 'Severity: General Policy',
    description: 'The platform applies graduated disciplinary measures from mild to severe based on the impact and gravity of the violation.',
    actions: [
      'Tier 1 (Warning): Direct reminder; automated filter masks content with ***.',
      'Tier 2 (Temporary Suspension): Messaging and file transfers locked from 1 hour to 7 days.',
      'Tier 3 (Permanent Termination): Permanent device UID blacklist and IP ban.'
    ],
    penalties: [
      'Suspended users may submit an appeal with supporting evidence to Administrators for review in cases of mistaken identification.'
    ]
  },
  {
    id: '13',
    ruleNumber: 'Rule 13',
    title: 'Personal Data Protection (VN Decree 13/2023 & Global GDPR/CCPA)',
    category: 'system',
    severity: 'high',
    severityLabel: 'Severity: Data Law Compliance',
    description: 'Aligned with Vietnam Decree 13/2023/ND-CP, Cybersecurity Law, EU GDPR & CCPA: Personal data (Email, Phone OTP, Google/Facebook/GitHub profile, Cloud files) is minimally collected with explicit consent; unauthorized harvesting or data selling is strictly forbidden.',
    actions: [
      'Strictly prohibits scraping or harvesting Email addresses, phone numbers, UIDs, or member profiles.',
      'Strictly prohibits selling, trading, or coercing disclosure of sensitive personal information.',
      'Users retain full rights to access, rectify, withdraw consent, and erase their Cloud files/sessions anytime (GDPR Right to Erasure).'
    ],
    penalties: [
      'Permanent ban on accounts or bots harvesting user data without consent.',
      '72-hour breach notification policy and verified data deletion support upon request.'
    ]
  },

  // --- DEVELOPER & ADMINISTRATOR RULES ---
  {
    id: '14',
    ruleNumber: 'Rule 14',
    title: 'Authority Limits & Anti-Abuse Code for DEV / Administrators',
    category: 'dev',
    severity: 'high',
    severityLabel: 'Severity: DEV Constraint',
    description: 'Just as users abide by community rules, Developers (DEV) and Administrators are strictly bound: Manual account bans/restrictions may only be issued for verifiable rule violations or urgent security threats.',
    actions: [
      'Strictly prohibits banning users over personal grudges, emotions, or personal retaliation.',
      'Every manual Ban/Unban performed in Datastore must include a clear, factual reason.',
      'DEV accounts must uphold civil communication standards and never exploit DEV badges to intimidate or coerce users.'
    ],
    penalties: [
      'Any wrongful or arbitrary ban must be lifted and reverted immediately.',
      'Personnel who abuse moderation power have their DEV/Admin privileges permanently revoked.'
    ]
  },
  {
    id: '15',
    ruleNumber: 'Rule 15',
    title: 'Zero Snooping Privacy Duty & Fair Remediation by DEV',
    category: 'dev',
    severity: 'critical',
    severityLabel: 'Severity: DEV Ethics & Law',
    description: 'DEVs are strictly forbidden from exploiting technical access to peek at, copy, or leak user files, private messages, or personal info (Email, Phone, DOB), and must review appeals impartially.',
    actions: [
      'Never snoop on private content or extract user personal data outside legitimate bug-fixing or legal compliance.',
      'Review AI false-positive flags or manual ban appeals fairly within 24 - 48 business hours.',
      'Unban immediately and erase wrongful violation marks whenever a mistake is verified.'
    ],
    penalties: [
      'Permanent revocation of Datastore access for any privacy or data confidentiality breach.',
      'Mandatory restoration of affected user accounts and prompt remediation of moderation defects.'
    ]
  }
];

// ==================== 简体中文社区规范 ====================
export const COMMUNITY_RULES_ZH: RuleClause[] = [
  // --- 言语与交流规范 ---
  {
    id: '1',
    ruleNumber: '规则 1',
    title: '侮辱名誉与人身攻击',
    category: 'speech',
    severity: 'medium',
    severityLabel: '严重程度：中',
    description: '严禁任何使用粗俗语言、贬低、辱骂或诋毁他人个人名誉、尊严、外貌、处境或家庭的行为。',
    actions: [
      '使用涉及生殖器官的粗鄙脏话或恶意辱骂。',
      '嘲讽、侮辱他人的外貌、个人背景、种族或家庭。',
      '在聊天室中进行暴力威胁或精神恐吓。'
    ],
    penalties: [
      '首次警告：系统自动将敏感词屏蔽为 ***。',
      '再次违规：暂停发言权限 24 小时。'
    ]
  },
  {
    id: '2',
    ruleNumber: '规则 2',
    title: '故意规避审核与伪装脏话',
    category: 'speech',
    severity: 'medium',
    severityLabel: '严重程度：中',
    description: '严禁故意插入句号、下划线、空格、特殊符号、数字替代字母或火星文，以绕过自动内容审查系统。',
    actions: [
      '故意拆分拼写：f.u.c.k、s-e-x、b_i_t_c_h、c.a.o 等。',
      '使用谐音、缩写或隐晦粗俗俚语。',
      '使用数字替代字母：sh1t、d1ck、s3x 等。'
    ],
    penalties: [
      '系统自动识别并屏蔽为 ***，同时记录一次违规。',
      '多次故意绕过审核刷屏：封禁账号 1 至 12 小时。'
    ]
  },
  {
    id: '3',
    ruleNumber: '规则 3',
    title: '地域歧视、宗教侮辱与煽动仇恨',
    category: 'speech',
    severity: 'high',
    severityLabel: '严重程度：高',
    description: '严格遵守网络安全法规：绝对禁止发表分裂地域文化、侮辱宗教信仰、种族、性别或煽动暴力的言论。',
    actions: [
      '使用贬低特定地区文化、口音或人群的歧视性词汇。',
      '亵渎宗教信仰、种族背景或性别身份。',
      '传播虚假谣言、极端宣传或煽动暴力聚集。'
    ],
    penalties: [
      '封禁账号并限制访问权限 3 至 7 天。',
      '严重煽动或传播仇恨言论者永久封禁。'
    ]
  },
  {
    id: '4',
    ruleNumber: '规则 4',
    title: '性骚扰与粗俗搭讪',
    category: 'speech',
    severity: 'high',
    severityLabel: '严重程度：高',
    description: '严禁发送粗俗性暗示信息、进行性骚扰或强迫他人接收敏感不雅内容。',
    actions: [
      '向他人索要私密、敏感或露骨照片与视频。',
      '对聊天室成员的身体发表下流、淫秽的评论。',
      '在对方明确拒绝后仍持续纠缠或骚扰刷屏。'
    ],
    penalties: [
      '立即断开双方设备之间的 P2P 直连。',
      '禁止参与所有公共聊天室 48 小时。'
    ]
  },

  // --- 文件与媒体内容 ---
  {
    id: '5',
    ruleNumber: '规则 5',
    title: '传播色情、18+ 及儿童性剥削内容',
    category: 'file',
    severity: 'critical',
    severityLabel: '严重程度：极其严重',
    description: '依据国际公约与网络安全法规：绝对禁止上传、发送、转发或存储色情、淫秽媒体或任何涉及儿童性剥削与虐待的内容 (CSAM)。',
    actions: [
      '发送露骨照片、裸露视频或 18+ 成人色情影片。',
      '传播淫秽色情资源合集或违法成人网站链接。',
      '任何涉及剥削、侵害未成年人的影像或信息。'
    ],
    penalties: [
      '最高处罚：永久封禁涉事账号及关联邮箱/手机号，并吊销授权。',
      '保存证据链并依法配合相关部门追责处理。'
    ]
  },
  {
    id: '6',
    ruleNumber: '规则 6',
    title: '极端暴力、血腥恐怖与自残内容',
    category: 'file',
    severity: 'critical',
    severityLabel: '严重程度：极其严重',
    description: '严禁分享血腥残忍画面、恶性事故现场、虐待动物或人体酷刑、自杀自残引导以及武器制造教程。',
    actions: [
      '分享非医疗教学用途的遗体或严重创伤血腥画面。',
      '教唆、美化或传播自杀、自残相关图文视频。',
      '传播恐怖主义宣传、爆炸物或危险武器制造指南。'
    ],
    penalties: [
      'AI 审核系统在传输前自动拦截并清除文件。',
      '视情节封禁账号 7 天至永久封禁。'
    ]
  },
  {
    id: '7',
    ruleNumber: '规则 7',
    title: '传播病毒、恶意软件与钓鱼诈骗链接',
    category: 'file',
    severity: 'critical',
    severityLabel: '严重程度：极其严重',
    description: '严禁传输包含木马、勒索病毒、键盘记录器、压缩包炸弹 (Zip Bomb) 的文件或旨在盗取账号与数据的钓鱼链接。',
    actions: [
      '伪装正常软件发送恶意可执行文件 (.exe/.bat/.scr)。',
      '发送旨在瘫痪接收方设备内存或硬盘的压缩包炸弹。',
      '发送仿冒银行或社交平台的虚假登录钓鱼链接。'
    ],
    penalties: [
      '立即永久封禁涉事账号。',
      '将恶意文件 SHA-256 哈希值加入全网拦截黑名单。'
    ]
  },
  {
    id: '8',
    ruleNumber: '规则 8',
    title: '侵犯个人隐私与人肉搜索 (Doxxing)',
    category: 'file',
    severity: 'high',
    severityLabel: '严重程度：高',
    description: '严禁在未经本人明确合法许可的情况下，公开或泄露他人的个人身份识别信息。',
    actions: [
      '在聊天室上传他人身份证、护照或私密证件照片。',
      '公开他人手机号、家庭住址或银行账户信息用于骚扰。',
      '泄露个人或机构内部机密文件与敏感记录。'
    ],
    penalties: [
      '立即删除并清除所有违规泄露内容。',
      '锁定文件传输与消息功能 3 至 14 天。'
    ]
  },

  // --- 系统与聊天室规范 ---
  {
    id: '9',
    ruleNumber: '规则 9',
    title: '消息刷屏与恶意占用系统带宽',
    category: 'system',
    severity: 'medium',
    severityLabel: '严重程度：中',
    description: '严禁高频发送垃圾信息、使用自动化脚本恶意刷屏或发送大量垃圾文件堵塞他人的 P2P/Relay 传输通道。',
    actions: [
      '短时间内连续发送数十条重复或无意义消息。',
      '未经同意向聊天室连续发送超大垃圾文件。',
      '使用自动化机器人或压测脚本导致聊天室卡顿。'
    ],
    penalties: [
      '触发速率限制，暂时禁言 30 至 60 分钟。',
      '房主有权立即将捣乱成员踢出房间。'
    ]
  },
  {
    id: '10',
    ruleNumber: '规则 10',
    title: '冒充管理员 (Admin/Dev) 与欺诈行为',
    category: 'system',
    severity: 'high',
    severityLabel: '严重程度：高',
    description: '严禁将设备名或昵称设为管理员、技术团队或系统官方以欺诈财物、套取密码或恐吓其他用户。',
    actions: [
      '使用“系统”“管理员”“Admin”等名称索要 PIN 码或密码。',
      '冒充开发者向用户索取隐私数据或钱财。',
      '创建虚假中奖或官方活动房间实施诈骗。'
    ],
    penalties: [
      '收回违规昵称并永久封禁冒充账号。',
      '列入全平台反欺诈预警名单。'
    ]
  },
  {
    id: '11',
    ruleNumber: '规则 11',
    title: '聊天室房主权限与管理责任',
    category: 'system',
    severity: 'low',
    severityLabel: '严重程度：一般规范',
    description: '房主有责任维护房间秩序，并有权依据社区规范处置违规成员。',
    actions: [
      '房主有权删除违反社区规范的消息。',
      '房主有权将持续刷屏或捣乱的成员移出房间。',
      '遇到陌生人恶意闯入骚扰时可随时更换房间密码。'
    ],
    penalties: [
      '若房主故意纵容 18+ 色情内容（规则 5）或恶意软件（规则 7），整个房间将被解散且房主需承担连带责任。'
    ]
  },

  // --- 处罚标准与申诉 ---
  {
    id: '12',
    ruleNumber: '规则 12',
    title: '违规分级处理与公平申诉机制',
    category: 'sanctions',
    severity: 'low',
    severityLabel: '严重程度：通用条款',
    description: '平台根据违规行为的影响范围和严重程度，采取从轻到重的分级处罚措施。',
    actions: [
      '一级（警告）：直接提醒，系统自动将违规词汇屏蔽为 ***。',
      '二级（限时封禁）：锁定发消息和传文件权限 1 小时至 7 天。',
      '三级（永久封禁）：永久封禁涉事账号及其关联的同邮箱/同手机号账号。'
    ],
    penalties: [
      '如认为系统误判，被封禁用户可附带证明材料向管理员提交申诉以申请人工复核解封。'
    ]
  },
  {
    id: '13',
    ruleNumber: '规则 13',
    title: '个人数据保护合规（越南第 13/2023 号法令及国际 GDPR/CCPA）',
    category: 'system',
    severity: 'high',
    severityLabel: '严重程度：数据保护法规',
    description: '遵循越南第 13/2023/NĐ-CP 号法令、《网络安全法》及欧盟 GDPR、美国 CCPA 核心标准：平台遵循最小化与明示同意原则处理个人数据（邮箱、手机 OTP、Google/Facebook/GitHub 登录信息及云盘文件），严禁任何未经授权的数据抓取或倒卖行为。',
    actions: [
      '严禁运行爬虫或脚本批量采集其他用户的邮箱、手机号、UID 或个人资料。',
      '严禁出售、交换用户个人数据或强迫他人提供敏感隐私信息。',
      '用户随时享有查阅、更正、撤回同意以及删除云盘文件和登录会话的权利（被遗忘权）。'
    ],
    penalties: [
      '永久封禁侵犯个人数据保护条款的账号及自动化工具。',
      '承诺履行 72 小时数据安全事件通报机制并支持合法的数据删除申请。'
    ]
  },

  // --- 开发者与管理员规范 ---
  {
    id: '14',
    ruleNumber: '规则 14',
    title: '开发者 (DEV) 与管理员权限边界及严禁滥用职权',
    category: 'dev',
    severity: 'high',
    severityLabel: '严重程度：DEV 约束',
    description: '正如用户须遵守社区规范，开发者 (DEV) 与管理员同样受严格规则约束：仅可在存在真实违规证据或紧急安全威胁时执行手动封禁 (Ban) 或功能限制。',
    actions: [
      '严禁因个人恩怨、情绪化或私人报复随意封禁用户账号。',
      '在后台执行的每一项手动封禁/解封 (Ban/Unban) 操作均须填写清晰真实的理由。',
      'DEV 账号在社区发言时须保持文明礼貌，严禁借 DEV 徽章恐吓或强迫用户。'
    ],
    penalties: [
      '任何违规或误判封禁必须立即撤销并恢复账号。',
      '滥用审核权限者将被永久撤销 DEV 与管理员权限。'
    ]
  },
  {
    id: '15',
    ruleNumber: '规则 15',
    title: '开发者严守数据隐私 (Zero Snooping) 与公正纠错义务',
    category: 'dev',
    severity: 'critical',
    severityLabel: '严重程度：DEV 道德与法规',
    description: '严禁 DEV 利用技术访问权限偷窥、复制或泄露用户的云盘文件、私密聊天记录及个人资料（邮箱、手机、生日），并须公正审核用户申诉。',
    actions: [
      '不得在正当故障排查或法定合规之外擅自查阅私人内容或导出用户个人信息。',
      '在 24 至 48 个工作小时内公正复核 AI 误判或手动封禁申诉。',
      '确认误判后须立即解除封禁 (Unban) 并清除错误违规记录。'
    ],
    penalties: [
      '任何侵犯用户隐私的行为将导致后台访问权限被永久吊销。',
      '必须及时修复审核缺陷并恢复受影响用户的完整权益。'
    ]
  }
];

// Default export alias for backward compatibility
export const COMMUNITY_RULES: RuleClause[] = COMMUNITY_RULES_VI;

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
  onAccept?: () => void;
  initialCategory?: 'all' | 'speech' | 'file' | 'system' | 'sanctions' | 'dev';
}

export const RulesModal: React.FC<RulesModalProps> = ({ 
  isOpen, 
  onClose,
  isMandatory = false,
  onAccept,
  initialCategory = 'all'
}) => {
  const { currentLang, setLanguage } = useLanguage();
  const isZh = currentLang === 'zh-CN' || currentLang === 'zh-TW';
  const pick = (vi: string, en: string, zh?: string) => pickLang(currentLang, vi, en, zh);

  const [activeCategory, setActiveCategory] = useState<'all' | 'speech' | 'file' | 'system' | 'sanctions' | 'dev'>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);

  // Ref for horizontal category bar to handle smooth mousewheel scrolling without Shift
  const categoryTabsRef = useRef<HTMLDivElement>(null);

  // Attach non-passive wheel event listener to category tabs container
  useEffect(() => {
    const el = categoryTabsRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If user is rolling vertical wheel (deltaY) and not already doing trackpad horizontal (deltaX)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const canScrollLeft = e.deltaY < 0 && el.scrollLeft > 0;
        const canScrollRight = e.deltaY > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth;
        if (canScrollLeft || canScrollRight) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen, isMandatory]);

  // Select localized rules set across all 33 languages
  const currentRules = useMemo(() => {
    if (currentLang === 'vi') return COMMUNITY_RULES_VI;
    if (currentLang === 'zh-CN') return COMMUNITY_RULES_ZH;
    if (currentLang === 'en') return COMMUNITY_RULES_EN;
    return COMMUNITY_RULES_EN.map((enRule, i) => {
      const viRule = COMMUNITY_RULES_VI[i] || enRule;
      const zhRule = COMMUNITY_RULES_ZH[i] || enRule;
      return {
        ...enRule,
        ruleNumber: pickLang(currentLang, viRule.ruleNumber, enRule.ruleNumber, zhRule.ruleNumber),
        title: pickLang(currentLang, viRule.title, enRule.title, zhRule.title),
        severityLabel: pickLang(currentLang, viRule.severityLabel, enRule.severityLabel, zhRule.severityLabel),
        description: pickLang(currentLang, viRule.description, enRule.description, zhRule.description),
        actions: enRule.actions.map((act, j) =>
          pickLang(currentLang, viRule.actions[j] ?? act, act, zhRule.actions[j] ?? act)
        ),
        penalties: enRule.penalties.map((pen, j) =>
          pickLang(currentLang, viRule.penalties[j] ?? pen, pen, zhRule.penalties[j] ?? pen)
        ),
      };
    });
  }, [currentLang]);

  // When mandatory (first login), always display all 12 rules without search or category filtering
  const displayedRules = useMemo(() => {
    if (isMandatory) {
      return currentRules;
    }
    return currentRules.filter(rule => {
      const matchCategory = activeCategory === 'all' || rule.category === activeCategory;
      if (!matchCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        rule.ruleNumber.toLowerCase().includes(q) ||
        rule.title.toLowerCase().includes(q) ||
        rule.description.toLowerCase().includes(q) ||
        rule.actions.some(act => act.toLowerCase().includes(q)) ||
        rule.penalties.some(pen => pen.toLowerCase().includes(q))
      );
    });
  }, [isMandatory, activeCategory, searchQuery, currentRules]);

  if (!isOpen) return null;

  const handleCopyRule = (rule: RuleClause) => {
    const basisHeader = `[${pick('Căn cứ', 'Basis:', '依据')} ${rule.ruleNumber}: ${rule.title}]`;
    const actionsHeader = pick('- Các Hành Vi Cụ Thể:', '- Specific Prohibited Actions:', '- 具体违规行为：');
    const penaltiesHeader = pick('- Căn Cứ Xử Phạt:', '- Sanctions & Penalties:', '- 处罚标准与措施：');
    const textToCopy = `${basisHeader}\n${actionsHeader}\n${rule.actions.map(a => `+ ${a}`).join('\n')}\n${penaltiesHeader}\n${rule.penalties.map(p => `+ ${p}`).join('\n')}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(rule.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const renderSeverityBadge = (rule: RuleClause) => {
    switch (rule.severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Flame className="w-3.5 h-3.5" />
            {pick('Mức độ: CỰC KỲ NGHIÊM TRỌNG', 'Severity: Critical', '严重程度：极其严重')}
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {pick('Mức độ: Cao', 'Severity: High', '严重程度：高')}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3.5 h-3.5" />
            {pick('Mức độ: Trung bình', 'Severity: Medium', '严重程度：中')}
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {rule.category === 'sanctions'
              ? pick('Mức độ: Quy định chung', 'Severity: General Rule', '严重程度：通用条款')
              : pick('Mức độ: Thấp', 'Severity: Low', '严重程度：一般规范')}
          </span>
        );
    }
  };

  const handleStartUsing = () => {
    if (!hasAgreed && isMandatory) return;
    if (onAccept) {
      onAccept();
    } else {
      onClose();
    }
  };

  // Localized text dictionary for modal UI via pick() -> translated into all 33 languages
  const labels = {
    title: pick('Nội Quy & Điều Khoản Sử Dụng Web', 'Web Terms of Use & Community Guidelines', '平台使用条款与社区规范'),
    mandatoryBadge: pick('Bắt buộc xác nhận', 'Required Confirmation', '必须确认'),
    subtitle: pick('(Lọc theo các luật an ninh mạng của Việt Nam, luật của các quốc gia và quy định của web)', '(Filtered in accordance with cybersecurity laws of Vietnam, international regulations, and web policies)', '（依据网络安全法规、国际标准及平台管理规范制定）'),
    close: pick('Đóng', 'Close', '关闭'),
    all: `${pick('Tất cả', 'All', '全部')} (${currentRules.length})`,
    speech: pick('Ngôn từ & Giao tiếp', 'Language & Communication', '言语与交流'),
    file: pick('Tệp tin & Hình ảnh', 'Files & Media', '文件与媒体'),
    system: pick('Hệ thống & Phòng chat', 'System & Chat Rooms', '系统与聊天室'),
    sanctions: pick('Khung xử phạt', 'Penalties & Sanctions', '处罚与申诉'),
    dev: pick('Luật dành cho DEV', 'DEV Rules', '开发者规范'),
    searchPlaceholder: pick('Tìm điều luật (ví dụ: Luật 1, 18+, DEV, lách luật)...', 'Search rules (e.g. Rule 1, 18+, DEV, bypass)...', '搜索规则（例如：规则 1、18+、DEV、绕过）...'),
    mandatoryNotice: pick(
      `Chào mừng bạn đến với CloudSend! Vui lòng xem ${currentRules.length} điều luật (bao gồm quy tắc cho người dùng & DEV) dưới đây, tích xác nhận ở cuối trang và nhấn Bắt đầu sử dụng.`,
      `Welcome to CloudSend! Please review the ${currentRules.length} rules (covering both users & DEVs) below, check the confirmation box at the bottom, and click Start using.`,
      `欢迎来到 CloudSend！请阅读下方 ${currentRules.length} 条社区与开发者规范，勾选底部确认框后点击“开始使用”。`
    ),
    mandatoryCounter: `${currentRules.length} / ${currentRules.length} ${pick('Điều luật', 'Rules', '条规则')}`,
    actionsLabel: pick('- Các Hành Vi Cụ Thể:', '- Specific Prohibited Actions:', '- 具体违规行为：'),
    penaltiesLabel: pick('- Căn Cứ Xử Phạt & Chế Tài:', '- Sanctions & Penalties:', '- 处罚依据与措施：'),
    appliesToAll: pick('Áp dụng cho toàn bộ người dùng trong hệ thống', 'Applies to all users across the system', '适用于平台全体用户'),
    appliesToDev: pick('Áp dụng bắt buộc cho DEV & Ban Quản Trị', 'Binding on all DEV & Admin accounts', '强制适用于所有 DEV 与管理员账号'),
    copyBtn: pick('Sao chép', 'Copy', '复制'),
    copiedBtn: pick('Đã sao chép điều luật!', 'Rule copied!', '已复制规则！'),
    copyTooltip: pick('Sao chép điều luật để gửi làm căn cứ xử lý vi phạm', 'Copy rule to cite for moderation', '复制规则以作为处理违规行为的依据'),
    confirmTitle: pick('Xác Nhận Chấp Nhận Nội Quy Web CloudSend', 'Confirm Acceptance of CloudSend Web Rules', '确认同意 CloudSend 平台社区规范'),
    confirmDesc: pick(
      `Bằng việc xác nhận chấp nhận, bạn cam kết tuân thủ đầy đủ ${currentRules.length} điều luật trên (bao gồm quy chuẩn minh bạch hai chiều giữa người dùng & DEV) để giữ an toàn cho mọi thành viên.`,
      `By confirming acceptance, you commit to comply with all ${currentRules.length} rules above (establishing fair two-way accountability for both users & DEVs) to keep every member safe.`,
      `确认同意即表示您认可并遵守以上 ${currentRules.length} 条规则（包含用户与 DEV 双向公平规范），共同维护安全友好的环境。`
    ),
    agreeCheckbox: pick('Tôi đã đọc và xác nhận chấp nhận các luật của web CloudSend', 'I have read and agree to comply with CloudSend web rules', '我已阅读并同意遵守 CloudSend 平台使用规则'),
    startUsing: pick('Bắt đầu sử dụng', 'Start using', '开始使用'),
    footerMandatoryHint: pick('* Kéo xuống cuối trang để tích xác nhận và bắt đầu sử dụng.', '* Scroll to the bottom to confirm acceptance and get started.', '* 请滚动至底部勾选确认并开始使用。'),
    footerNotice: pick('Người dùng có thể sao chép điều luật để nhắc nhở thành viên vi phạm trong phòng chat.', 'Users can copy rules to remind violating members in chat rooms.', '用户可复制规则条款以在聊天室中提醒违规成员。'),
    footerClose: pick('Đã hiểu & Đóng', 'Understood & Close', '我已了解并关闭'),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-modal-title"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="rules-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {labels.title}
                </h2>
                {isMandatory && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                    {labels.mandatoryBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-300/90 font-medium">
                {labels.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher Button (VI / EN / ZH) */}
            <div translate="no" className="notranslate flex items-center rounded-xl bg-slate-900 border border-slate-700/80 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentLang === 'vi'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span className="hidden sm:inline">Tiếng Việt</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  currentLang === 'en'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="English"
              >
                <span>🇬🇧</span>
                <span className="hidden sm:inline">English</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('zh-CN')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  isZh
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="中文 (简体 / 繁體)"
              >
                <span>🇨🇳</span>
                <span className="hidden sm:inline">中文</span>
              </button>
            </div>

            {/* Close button only shown when not in mandatory first-login mode */}
            {!isMandatory && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={labels.close}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar - Only shown in normal mode, hidden in mandatory onboarding mode */}
        {!isMandatory && (
          <div className="p-3.5 sm:px-6 border-b border-slate-800 bg-slate-900/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            {/* Categories - Supports direct mousewheel horizontal scrolling */}
            <div 
              ref={categoryTabsRef}
              onWheel={(e) => {
                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
              className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none select-none"
            >
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels.all}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('speech')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === 'speech'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels.speech}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === 'file'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels.file}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('system')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === 'system'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels.system}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('sanctions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === 'sanctions'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels.sanctions}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('dev')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === 'dev'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels.dev}
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[200px] sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={labels.searchPlaceholder}
                className="w-full pl-9 pr-7 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notice for First-time Login */}
        {isMandatory && (
          <div className="px-5 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{labels.mandatoryNotice}</span>
            </div>
            <span className="text-[11px] font-mono text-amber-300 font-bold shrink-0">{labels.mandatoryCounter}</span>
          </div>
        )}

        {/* Rules Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {displayedRules.map((rule) => {
            const isCopied = copiedId === rule.id;

            return (
              <div
                key={rule.id}
                id={`rule-clause-${rule.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3 shadow-sm"
              >
                {/* Top Bar: Title on Left, Severity on Top-Right */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-emerald-400">
                      {rule.ruleNumber}: {rule.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>

                  {/* Severity badge on top right */}
                  <div className="shrink-0">
                    {renderSeverityBadge(rule)}
                  </div>
                </div>

                {/* Body: Actions & Penalties */}
                <div className="space-y-2 pt-1 text-xs sm:text-sm">
                  <div>
                    <div className="font-bold text-amber-400 text-xs mb-1">
                      {labels.actionsLabel}
                    </div>
                    <div className="space-y-1 pl-2 sm:pl-3 text-slate-300">
                      {rule.actions.map((act, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold shrink-0">+</span>
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sanctions & Penalties */}
                  <div className="pt-1">
                    <div className="font-bold text-rose-400 text-xs mb-1">
                      {labels.penaltiesLabel}
                    </div>
                    <div className="space-y-1 pl-2 sm:pl-3 text-slate-300">
                      {rule.penalties.map((pen, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-rose-400 font-bold shrink-0">+</span>
                          <span>{pen}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Bar: Copy button on bottom right */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className={`text-[11px] hidden sm:inline ${rule.category === 'dev' ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {rule.category === 'dev' ? labels.appliesToDev : labels.appliesToAll}
                  </span>

                  {/* Copy button */}
                  <button
                    type="button"
                    onClick={() => handleCopyRule(rule)}
                    title={labels.copyTooltip}
                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isCopied
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? labels.copiedBtn : labels.copyBtn}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Mandatory Confirmation Box at the bottom of 12 rules */}
          {isMandatory && (
            <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/30 border-2 border-emerald-500/40 space-y-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    {labels.confirmTitle}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {labels.confirmDesc}
                  </p>
                </div>
              </div>

              {/* Checkbox */}
              <label 
                id="rules-agree-label"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-colors select-none group"
              >
                <input
                  type="checkbox"
                  id="agree-rules-checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer accent-emerald-500"
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                  {labels.agreeCheckbox}
                </span>
              </label>

              {/* Start using button */}
              <button
                id="start-using-app-btn"
                type="button"
                disabled={!hasAgreed}
                onClick={handleStartUsing}
                className={`w-full py-3 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  hasAgreed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/80'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{labels.startUsing}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          {isMandatory ? (
            <>
              <span className="text-amber-300/80">
                {labels.footerMandatoryHint}
              </span>

              <button
                type="button"
                disabled={!hasAgreed}
                onClick={handleStartUsing}
                className={`w-full sm:w-auto px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  hasAgreed
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                {labels.startUsing}
              </button>
            </>
          ) : (
            <>
              <span>{labels.footerNotice}</span>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
              >
                {labels.footerClose}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
