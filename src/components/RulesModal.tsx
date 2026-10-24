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
import { useLanguage } from '../context/LanguageContext';

export interface RuleClause {
  id: string;
  ruleNumber: string; // "Luật 1" or "Rule 1"
  title: string;
  category: 'all' | 'speech' | 'file' | 'system' | 'sanctions';
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
  }
];

// Default export alias for backward compatibility
export const COMMUNITY_RULES: RuleClause[] = COMMUNITY_RULES_VI;

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
  onAccept?: () => void;
  initialCategory?: 'all' | 'speech' | 'file' | 'system' | 'sanctions';
}

export const RulesModal: React.FC<RulesModalProps> = ({ 
  isOpen, 
  onClose,
  isMandatory = false,
  onAccept,
  initialCategory = 'all'
}) => {
  const { currentLang } = useLanguage();
  const isEn = currentLang === 'en';

  const [activeCategory, setActiveCategory] = useState<'all' | 'speech' | 'file' | 'system' | 'sanctions'>(initialCategory);
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

  // Select localized rules set
  const currentRules = useMemo(() => {
    return isEn ? COMMUNITY_RULES_EN : COMMUNITY_RULES_VI;
  }, [isEn]);

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
    const textToCopy = isEn
      ? `[Basis: ${rule.ruleNumber}: ${rule.title}]\n- Specific Prohibited Actions:\n${rule.actions.map(a => `+ ${a}`).join('\n')}\n- Sanctions & Penalties:\n${rule.penalties.map(p => `+ ${p}`).join('\n')}`
      : `[Căn cứ ${rule.ruleNumber}: ${rule.title}]\n- Các Hành Vi Cụ Thể:\n${rule.actions.map(a => `+ ${a}`).join('\n')}\n- Căn Cứ Xử Phạt:\n${rule.penalties.map(p => `+ ${p}`).join('\n')}`;

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
            {isEn ? 'Severity: Critical' : rule.severityLabel}
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isEn ? 'Severity: High' : rule.severityLabel}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3.5 h-3.5" />
            {isEn ? 'Severity: Medium' : rule.severityLabel}
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {isEn ? (rule.category === 'sanctions' ? 'Severity: General Rule' : 'Severity: Low') : rule.severityLabel}
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

  // Localized text dictionary for modal UI
  const labels = isEn ? {
    title: 'Web Terms of Use & Community Guidelines',
    mandatoryBadge: 'Required Confirmation',
    subtitle: '(Filtered in accordance with cybersecurity laws of Vietnam, international regulations, and web policies)',
    close: 'Close',
    all: `All (${currentRules.length})`,
    speech: 'Language & Communication',
    file: 'Files & Media',
    system: 'System & Chat Rooms',
    sanctions: 'Penalties & Sanctions',
    searchPlaceholder: 'Search rules (e.g. Rule 1, 18+, bypass)...',
    mandatoryNotice: 'Welcome to CloudSend! Please review the 12 rules below, check the confirmation box at the bottom, and click Start using.',
    mandatoryCounter: '12 / 12 Rules',
    actionsLabel: '- Specific Prohibited Actions:',
    penaltiesLabel: '- Sanctions & Penalties:',
    appliesToAll: 'Applies to all users across the system',
    copyBtn: 'Copy',
    copiedBtn: 'Rule copied!',
    copyTooltip: 'Copy rule to cite for moderation',
    confirmTitle: 'Confirm Acceptance of CloudSend Web Rules',
    confirmDesc: 'By confirming acceptance, you commit to fully comply with all 12 rules above to maintain safety and a positive experience for all members.',
    agreeCheckbox: 'I have read and agree to comply with CloudSend web rules',
    startUsing: 'Start using',
    footerMandatoryHint: '* Scroll to the bottom to confirm acceptance and get started.',
    footerNotice: 'Users can copy rules to remind violating members in chat rooms.',
    footerClose: 'Understood & Close',
  } : {
    title: 'Nội Quy & Điều Khoản Sử Dụng Web',
    mandatoryBadge: 'Bắt buộc xác nhận',
    subtitle: '(Lọc theo các luật an ninh mạng của Việt Nam, luật của các quốc gia và quy định của web)',
    close: 'Đóng',
    all: `Tất cả (${currentRules.length})`,
    speech: 'Ngôn từ & Giao tiếp',
    file: 'Tệp tin & Hình ảnh',
    system: 'Hệ thống & Phòng chat',
    sanctions: 'Khung xử phạt',
    searchPlaceholder: 'Tìm điều luật (ví dụ: Luật 1, 18+, lách luật)...',
    mandatoryNotice: 'Chào mừng bạn đến với CloudSend! Vui lòng xem 12 điều luật dưới đây, tích xác nhận ở cuối trang và nhấn Bắt đầu sử dụng.',
    mandatoryCounter: '12 / 12 Điều luật',
    actionsLabel: '- Các Hành Vi Cụ Thể:',
    penaltiesLabel: '- Căn Cứ Xử Phạt & Chế Tài:',
    appliesToAll: 'Áp dụng cho toàn bộ người dùng trong hệ thống',
    copyBtn: 'Sao chép',
    copiedBtn: 'Đã sao chép điều luật!',
    copyTooltip: 'Sao chép điều luật để gửi làm căn cứ xử lý vi phạm',
    confirmTitle: 'Xác Nhận Chấp Nhận Nội Quy Web CloudSend',
    confirmDesc: 'Bằng việc xác nhận chấp nhận, bạn cam kết tuân thủ đầy đủ 12 điều luật trên để giữ an toàn và trải nghiệm tốt cho mọi thành viên.',
    agreeCheckbox: 'Tôi đã đọc và xác nhận chấp nhận các luật của web CloudSend',
    startUsing: 'Bắt đầu sử dụng',
    footerMandatoryHint: '* Kéo xuống cuối trang để tích xác nhận và bắt đầu sử dụng.',
    footerNotice: 'Người dùng có thể sao chép điều luật để nhắc nhở thành viên vi phạm trong phòng chat.',
    footerClose: 'Đã hiểu & Đóng',
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

          {/* Close button only shown when not in mandatory first-login mode */}
          {!isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={labels.close}
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    {labels.appliesToAll}
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
