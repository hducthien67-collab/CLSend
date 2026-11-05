/**
 * BỘ LUẬT ĐIỀU KHOẢN SỬ DỤNG & QUY TẮC AN TOÀN CHÍNH THỨC CLSEND
 * Cập nhật phiên bản: v2.5 Stable (2026)
 * Phân cấp điều khoản: Điều [X] -> Khoản [X.Y] -> Điểm chi tiết & Chế tài
 */

export interface SubClause {
  id: string; // e.g. "1.1"
  clauseNumber: string; // "1.1"
  title: string;
  description: string;
  examples: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  severityLabel: string;
  penalty: string;
}

export interface MainArticle {
  id: string;
  articleNumber: string; // "Điều 1"
  title: string;
  category: 'speech' | 'file' | 'cloud' | 'privacy' | 'account' | 'sanctions' | 'legal';
  categoryLabel: string;
  summary: string;
  subClauses: SubClause[];
}

export const OFFICIAL_TERMS_OF_SERVICE: MainArticle[] = [
  // ==================== ĐIỀU 1 ====================
  {
    id: 'dieu-1',
    articleNumber: 'Điều 1',
    title: 'Quy Định Về Ngôn Ngữ Giao Tiếp & Ứng Xử Trong Phòng Trò Chuyện',
    category: 'speech',
    categoryLabel: 'Giao Tiếp & Ngôn Từ',
    summary: 'Áp dụng cho tất cả các phòng chat công cộng (Lounge), phòng chat nhóm P2P và các đoạn trao đổi văn bản trực tiếp trên hệ thống ClSend.',
    subClauses: [
      {
        id: '1.1',
        clauseNumber: '1.1',
        title: 'Hành vi xúc phạm danh dự, nhân phẩm & lăng mạ cá nhân',
        description: 'Nghiêm cấm tuyệt đối mọi hành vi sử dụng ngôn từ thô tục, hạ nhục, chửi bới, miệt thị nhân phẩm, ngoại hình, hoàn cảnh hoặc gia đình của thành viên khác.',
        examples: [
          'Chửi bới thô bạo bằng các danh từ bộ phận sinh dục hoặc từ ngữ tục tĩu.',
          'Bôi nhọ danh dự, thêu dệt tin đồn vô căn cứ nhằm phá hoại uy tín người khác.',
          'Sử dụng ngôn từ nhục mạ tập thể, cơ quan, tổ chức hoặc cộng đồng.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Vừa',
        penalty: 'Cảnh cáo lần 1 tự động che chắn ***; Tái phạm: Tạm khóa quyền gửi tin nhắn từ 6 giờ đến 24 giờ.'
      },
      {
        id: '1.2',
        clauseNumber: '1.2',
        title: 'Cố tình lách bộ lọc kiểm duyệt & ngụy trang từ ngữ tục tĩu',
        description: 'Nghiêm cấm hành vi cố ý chèn dấu chấm, gạch dưới, khoảng trắng, ký tự đặc biệt, số thay chữ hoặc teencode nhằm vượt qua hệ sinh thái AI kiểm duyệt tự động.',
        examples: [
          'Viết ngắt âm có chủ đích: d.i.t, d_i_t, f.u.c.k, s e x, l.o.n, c.a.c.',
          'Dùng ký tự số thay chữ cái: d1t, s3x, đ3o, vcl, dkm, clmm, dcm.',
          'Chèn biểu tượng cảm xúc hoặc ký tự unicode lạ vào giữa các từ cấm.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Vừa',
        penalty: 'Hệ thống tự động nhận diện mẫu (regex + AI), lọc bỏ ngay lập tức và ghi nhận 1 điểm vi phạm tài khoản.'
      },
      {
        id: '1.3',
        clauseNumber: '1.3',
        title: 'Kỳ thị sắc tộc, phân biệt vùng miền & kích động thù hận',
        description: 'Tuân thủ nghiêm ngặt Luật An ninh mạng: Nghiêm cấm mọi phát ngôn mang tính chia rẽ khối đại đoàn kết, xúc phạm văn hóa vùng miền (Bắc - Trung - Nam), tôn giáo, sắc tộc hoặc giới tính.',
        examples: [
          'Dùng từ ngữ miệt thị văn hóa, tiếng nói, lối sống của người dân các miền.',
          'Phỉ báng tín ngưỡng, tôn giáo, xúc phạm biểu tượng tâm linh.',
          'Kêu gọi cô lập, tẩy chay hoặc kích động bạo lực nhắm vào một nhóm người.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Cao',
        penalty: 'Đình chỉ tài khoản từ 3 đến 7 ngày; Khóa vĩnh viễn nếu tái phạm hoặc có yếu tố kích động nghiêm trọng.'
      },
      {
        id: '1.4',
        clauseNumber: '1.4',
        title: 'Quấy rối tình dục, gạ gẫm thô thiển & khủng bố tinh thần',
        description: 'Nghiêm cấm gửi tin nhắn gạ tình thô bỉ, ép buộc người khác cung cấp hình ảnh/video riêng tư hoặc liên tục làm phiền sau khi đối phương đã từ chối tiếp chuyện.',
        examples: [
          'Nhắn tin đòi hỏi hình ảnh nhạy cảm hoặc clip riêng tư.',
          'Bình luận khiếm nhã về cơ thể, tình dục của bất kỳ thành viên nào.',
          'Đe dọa dùng bạo lực, đe dọa tung tin giả hoặc khủng bố tin nhắn dồn dập.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Cao',
        penalty: 'Ngắt kết nối P2P lập tức giữa hai thiết bị và cấm tham gia toàn bộ phòng chat trong 48 đến 72 giờ.'
      },
      {
        id: '1.5',
        clauseNumber: '1.5',
        title: 'Spam tin nhắn, rải ký tự vô nghĩa & gây nghẽn phòng chat',
        description: 'Nghiêm cấm các hành vi gửi tin nhắn dồn dập với tần suất cao, spam văn bản dài hàng nghìn ký tự vô nghĩa (Zalgo text, crash font) nhằm làm lag hoặc đơ ứng dụng của người khác.',
        examples: [
          'Dùng công cụ bot tự động gửi hàng chục tin nhắn mỗi giây.',
          'Gửi văn bản ký tự biến dạng làm tràn bộ nhớ đệm (buffer overflow).',
          'Spam liên tục các đoạn quảng cáo bán hàng, link tiếp thị liên kết (affiliate).'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Vừa',
        penalty: 'Kích hoạt bộ giới hạn tần suất (Rate Limit 30 giây); Tạm ngắt kết nối phòng trong 1 giờ.'
      }
    ]
  },

  // ==================== ĐIỀU 2 ====================
  {
    id: 'dieu-2',
    articleNumber: 'Điều 2',
    title: 'Quy Định Về Truyền Tải Dữ Liệu P2P & Chia Sẻ Tệp Tin',
    category: 'file',
    categoryLabel: 'Truyền Tải & Tệp Tin',
    summary: 'Quy định các tiêu chuẩn an toàn cho toàn bộ luồng truyền tệp trực tiếp WebRTC P2P và truyền qua máy chủ trung chuyển Cloud Relay.',
    subClauses: [
      {
        id: '2.1',
        clauseNumber: '2.1',
        title: 'Tuyệt đối cấm văn hóa phẩm đồi trụy, 18+ & Khiêu dâm trẻ em',
        description: 'Căn cứ Công ước Quốc tế và Pháp luật Việt Nam: Nghiêm cấm TUYỆT ĐỐI việc tạo, gửi, chuyển tiếp hoặc lưu trữ hình ảnh, video khiêu dâm, đồi trụy hoặc hình ảnh bóc lột tình dục trẻ em (CSAM).',
        examples: [
          'Phát tán hình ảnh, video khỏa thân hoặc lộ các bộ phận nhạy cảm.',
          'Chia sẻ liên kết kho lưu trữ phim ảnh khiêu dâm, nội dung người lớn.',
          'Mọi nội dung có dấu hiệu xâm hại, bóc lột hoặc liên quan đến trẻ vị thành niên.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng bậc nhất',
        penalty: 'KHÓA VĨNH VIỄN thiết bị lập tức; Đưa địa chỉ IP vào danh sách đen (Blacklist) toàn hệ thống và lưu vết bằng chứng để bàn giao cơ quan có thẩm quyền.'
      },
      {
        id: '2.2',
        clauseNumber: '2.2',
        title: 'Nội dung bạo lực cực đoan, máu me, kinh dị & cổ súy tự hại',
        description: 'Nghiêm cấm chia sẻ hình ảnh thi thể biến dạng, tai nạn ghê rợn không mang tính chất giáo dục y khoa, các hành vi bạo lực tàn bạo, tự sát, tự gây thương tích hoặc tài liệu khủng bố.',
        examples: [
          'Hình ảnh/video tra tấn động vật hoặc hành hạ thể xác con người.',
          'Tài liệu hướng dẫn tự tử, hướng dẫn tự chế vũ khí, vật liệu nổ hoặc chất độc.',
          'Tuyên truyền các tổ chức khủng bố, bạo lực vũ trang.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng',
        penalty: 'Chặn tệp tự động ngay tại tầng truyền tải; Tạm khóa tài khoản 7 ngày hoặc khóa vĩnh viễn.'
      },
      {
        id: '2.3',
        clauseNumber: '2.3',
        title: 'Phát tán virus, mã độc hại, Trojan, Ransomware & Zip Bomb',
        description: 'Nghiêm cấm truyền tải tệp tin chứa phần mềm gián điệp, keylogger, virus tống tiền hoặc các tệp tin nén bom độc hại (Zip Bomb) nhằm phá hoại phần cứng, hệ điều hành của người nhận.',
        examples: [
          'Gửi tệp thực thi độc hại (.exe, .scr, .bat, .vbs) giả dạng tài liệu văn phòng.',
          'Gửi tệp nén 42.zip hoặc tệp giải nén hàng petabyte làm sập máy tính đối phương.',
          'Chèn mã khai thác trình duyệt (browser exploit) vào tệp tin HTML/SVG.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng',
        penalty: 'Khóa tài khoản vĩnh viễn; Đưa mã băm (Hash SHA-256) của tệp vào bộ lọc tiêu hủy toàn hệ sinh thái.'
      },
      {
        id: '2.4',
        clauseNumber: '2.4',
        title: 'Xâm phạm bản quyền thương mại & Phần mềm bẻ khóa độc hại',
        description: 'Nghiêm cấm chia sẻ các tệp tin chứa phần mềm crack, keygen giả mạo, bản quyền thương mại bị đánh cắp nhằm mục đích phân phối bất hợp pháp trên kênh truyền công cộng.',
        examples: [
          'Chia sẻ các tệp crack kèm trojan đào tiền ảo ẩn.',
          'Phát tán cơ sở dữ liệu nội bộ bị rò rỉ của doanh nghiệp hoặc tổ chức khác.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Cao',
        penalty: 'Gỡ bỏ tệp tin và cảnh cáo vi phạm bản quyền DMCA; Khóa tài khoản nếu tái phạm trên 3 lần.'
      },
      {
        id: '2.5',
        clauseNumber: '2.5',
        title: 'Lạm dụng kênh truyền P2P/Relay để tấn công từ chối dịch vụ (DDoS)',
        description: 'Nghiêm cấm việc cố tình mở đồng loạt hàng nghìn luồng truyền dữ liệu ảo (DataChannel Flood) nhằm chiếm dụng băng thông máy chủ Relay làm gián đoạn kết nối của cộng đồng.',
        examples: [
          'Dùng script tự động mở hàng loạt kết nối WebRTC giả mạo liên tục.',
          'Gửi các gói tin rác với dung lượng cực đại làm tê liệt bộ nhớ đệm người nhận.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng',
        penalty: 'Chặn IP và định danh thiết bị ở tầng hạ tầng Cloud; Khóa vĩnh viễn không xem xét kháng cáo.'
      }
    ]
  },

  // ==================== ĐIỀU 3 ====================
  {
    id: 'dieu-3',
    articleNumber: 'Điều 3',
    title: 'Quy Định Về Lưu Trữ Đám Mây & Kho Dữ Liệu Cloud Drive',
    category: 'cloud',
    categoryLabel: 'Lưu Trữ Cloud Drive',
    summary: 'Quy định về hạn mức lưu trữ, quyền sở hữu dữ liệu và cam kết bảo vệ dữ liệu trên hệ thống đám mây ClSend Cloud Drive.',
    subClauses: [
      {
        id: '3.1',
        clauseNumber: '3.1',
        title: 'Quyền sở hữu hợp pháp & trách nhiệm pháp lý đối với dữ liệu',
        description: 'Người dùng sở hữu 100% bản quyền đối với các tệp tin do mình tải lên. ClSend không tự ý đọc trộm, chỉnh sửa hoặc kinh doanh dữ liệu cá nhân của người dùng.',
        examples: [
          'Người dùng chịu trách nhiệm pháp lý duy nhất trước pháp luật đối với nội dung tệp tin mình lưu trữ.',
          'ClSend cung cấp hạ tầng kỹ thuật lưu trữ mã hóa an toàn theo tiêu chuẩn điện toán đám mây.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Quy chuẩn chung',
        penalty: 'Tự chịu trách nhiệm pháp lý nếu dữ liệu lưu trữ vi phạm luật pháp quốc gia sở tại.'
      },
      {
        id: '3.2',
        clauseNumber: '3.2',
        title: 'Hạn mức lưu trữ, kích thước tệp tin & quản lý tài nguyên',
        description: 'Người dùng phải sử dụng kho lưu trữ đúng mục đích, không cố tình khai thác lỗ hổng để vượt qua hạn ngạch dung lượng được cấp hoặc tải lên hàng triệu tệp tin rác 0KB.',
        examples: [
          'Không dùng công cụ spam tải lên tệp rác để làm cạn kiệt cơ sở dữ liệu đám mây.',
          'Tuân thủ định dạng tệp tin cho phép và giới hạn dung lượng tải lên mỗi tệp.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Vừa',
        penalty: 'Hệ thống tự động dọn dẹp các tệp rác bất thường và hạn chế tốc độ tải lên nếu phát hiện dấu hiệu lạm dụng.'
      },
      {
        id: '3.3',
        clauseNumber: '3.3',
        title: 'Mã hóa dữ liệu đầu cuối & Trách nhiệm lưu trữ khóa mã',
        description: 'Dữ liệu được mã hóa riêng tư trên trình duyệt trước khi đẩy lên đám mây. Người dùng có trách nhiệm ghi nhớ mật khẩu và mã PIN; ClSend không thể khôi phục dữ liệu nếu người dùng làm mất khóa bí mật cá nhân.',
        examples: [
          'Tự bảo vệ mật khẩu tài khoản và không chia sẻ mã PIN đồng bộ cho người lạ.',
          'Định kỳ sao lưu dữ liệu quan trọng sang thiết bị ngoại vi của cá nhân.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Khuyến nghị an toàn',
        penalty: 'Hệ thống không chịu trách nhiệm bồi thường nếu người dùng tự làm lộ mật khẩu hoặc khóa giải mã.'
      },
      {
        id: '3.4',
        clauseNumber: '3.4',
        title: 'Quy trình thu hồi & tiêu hủy tệp tin độc hại khỏi Cloud',
        description: 'Nếu phát hiện tệp tin trên Cloud Drive chứa mã độc nguy hiểm hoặc văn hóa phẩm cấm theo phán quyết pháp luật, ClSend có quyền cách ly và tiêu hủy tệp tin đó mà không cần báo trước.',
        examples: [
          'Tệp tin bị các nhà mạng quốc tế hoặc hệ thống quét virus cảnh báo đỏ (Red Alert).',
          'Tệp tin có lệnh thu hồi chính thức từ cơ quan quản lý an ninh thông tin.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng',
        penalty: 'Tiêu hủy tệp tin vi phạm ngay lập tức và đình chỉ quyền sử dụng Cloud Drive của tài khoản vi phạm.'
      }
    ]
  },

  // ==================== ĐIỀU 4 ====================
  {
    id: 'dieu-4',
    articleNumber: 'Điều 4',
    title: 'Bảo Vệ Quyền Riêng Tư, Dữ Liệu Cá Nhân & Chống Thu Thập Trái Phép (Anti-Doxxing)',
    category: 'privacy',
    categoryLabel: 'Bảo Vệ Quyền Riêng Tư',
    summary: 'Bảo vệ quyền bất khả xâm phạm về đời sống riêng tư, bí mật cá nhân và an toàn dữ liệu danh tính của mọi thành viên tham gia nền tảng.',
    subClauses: [
      {
        id: '4.1',
        clauseNumber: '4.1',
        title: 'Nghiêm cấm hành vi tiết lộ danh tính cá nhân trái phép (Doxxing)',
        description: 'Nghiêm cấm đăng tải, phát tán thông tin định danh cá nhân của người khác lên phòng chat công cộng hoặc gửi tệp tin chứa dữ liệu riêng tư khi chưa được đồng ý bằng văn bản.',
        examples: [
          'Công khai ảnh chụp Căn cước công dân (CCCD), Chứng minh thư, Hộ chiếu của người khác.',
          'Tiết lộ số điện thoại cá nhân, địa chỉ nhà ở, cơ quan làm việc, trường học.',
          'Công khai số tài khoản ngân hàng, thông tin số dư hoặc lịch sử giao dịch cá nhân.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Cao',
        penalty: 'Xóa bỏ dữ liệu vi phạm lập tức; Khóa tài khoản từ 7 ngày đến vĩnh viễn tùy mức độ ảnh hưởng đến nạn nhân.'
      },
      {
        id: '4.2',
        clauseNumber: '4.2',
        title: 'Chụp lén, ghi âm & rò rỉ nội dung tin nhắn riêng tư',
        description: 'Nghiêm cấm việc quay chụp các đoạn chat riêng tư, tệp tin gửi riêng trong kênh P2P mật đem phát tán ra bên ngoài nhằm mục đích hạ nhục hoặc tống tiền người gửi.',
        examples: [
          'Chụp màn hình cuộc trò chuyện riêng tư đăng lên mạng xã hội để bêu riếu.',
          'Dùng nội dung tin nhắn bí mật để đe dọa, đòi tiền chuộc hoặc cưỡng ép người khác.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Cao',
        penalty: 'Tước quyền truy cập phòng chat và chuyển giao nhật ký sự cố nếu có yêu cầu từ cơ quan bảo vệ pháp luật.'
      },
      {
        id: '4.3',
        clauseNumber: '4.3',
        title: 'Hành vi gián điệp mạng, chèn mã theo dõi & đánh cắp Token',
        description: 'Nghiêm cấm việc gửi các đoạn script độc hại, liên kết lừa đảo (Phishing) nhằm đánh cắp mã phiên đăng nhập (Auth Token) hoặc thông tin trình duyệt của người dùng.',
        examples: [
          'Giả mạo giao diện đăng nhập Google để lừa người dùng nhập tài khoản/mật khẩu.',
          'Gửi liên kết thu thập địa chỉ IP thực hoặc vị trí định vị địa lý (IP Logger).'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng',
        penalty: 'Khóa tài khoản vĩnh viễn; Liệt tên miền và địa chỉ IP của kẻ tấn công vào danh sách chặn tự động.'
      }
    ]
  },

  // ==================== ĐIỀU 5 ====================
  {
    id: 'dieu-5',
    articleNumber: 'Điều 5',
    title: 'Quy Định Về Quản Lý Tài Khoản, Định Danh Thiết Bị & Đồng Bộ Mã PIN',
    category: 'account',
    categoryLabel: 'Tài Khoản & Danh Tính',
    summary: 'Quy định về nghĩa vụ bảo vệ tài khoản người dùng, cơ chế đồng bộ nhanh qua mã 6 số và trách nhiệm khi sử dụng dịch vụ.',
    subClauses: [
      {
        id: '5.1',
        clauseNumber: '5.1',
        title: 'Nghĩa vụ tự bảo vệ mật khẩu, mã PIN 6 số & mã QR đăng nhập',
        description: 'Mỗi tài khoản được liên kết với một ID thiết bị và mật mã xác thực. Người dùng có nghĩa vụ bảo mật thông tin này, không cung cấp mã đồng bộ 6 số cho người lạ.',
        examples: [
          'Mã QR và mã 6 số đồng bộ là chìa khóa quyền truy cập trực tiếp tài khoản.',
          'ClSend không bao giờ yêu cầu người dùng đọc mã PIN đồng bộ qua bất kỳ tin nhắn nào.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Cảnh giác an toàn',
        penalty: 'Người dùng tự chịu trách nhiệm nếu tùy tiện chia sẻ mã PIN cho người khác dẫn đến mất mát dữ liệu.'
      },
      {
        id: '5.2',
        clauseNumber: '5.2',
        title: 'Nghiêm cấm hành vi mạo danh Ban Quản Trị, Dev hoặc Hệ Thống',
        description: 'Nghiêm cấm đặt tên hiển thị, hình đại diện hoặc gửi thông điệp giả mạo Quản trị viên, Nhà phát triển, Ban Điều Hành hoặc Thông báo hệ thống ClSend.',
        examples: [
          'Đặt tên hiển thị: "Admin ClSend", "Ban Quản Trị", "Hệ Thống Tự Động", "Dev Chính Chủ".',
          'Giả danh Quản trị viên yêu cầu người khác gửi mật khẩu hoặc nộp tiền phạt.',
          'Dùng huy hiệu giả mạo DEV để dọa dẫm người dùng mới.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Nghiêm trọng',
        penalty: 'Khóa vĩnh viễn tài khoản lập tức; Thu hồi tên hiển thị và đưa vào danh sách từ khóa cấm vĩnh cửu.'
      },
      {
        id: '5.3',
        clauseNumber: '5.3',
        title: 'Sử dụng công cụ tự động (Bot) & Tạo tài khoản ảo hàng loạt',
        description: 'Nghiêm cấm sử dụng các phần mềm tự động hóa (Bot, Crawler, Spammer) nhằm đăng ký hàng loạt tài khoản rác để phục vụ mục đích phá hoại tài nguyên hệ thống.',
        examples: [
          'Chạy công cụ tạo hàng trăm tài khoản khách ảo mỗi phút.',
          'Dùng bot tự động quét tệp tin trên kho đám mây không được cấp phép.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Cao',
        penalty: 'Kích hoạt tường lửa Cloudflare chặn toàn bộ dải IP của bot; Hủy toàn bộ tài khoản rác vừa tạo.'
      },
      {
        id: '5.4',
        clauseNumber: '5.4',
        title: 'Quy định đối với Chế độ Khách (Guest) & Tài khoản Chính thức',
        description: 'Chế độ Khách được cung cấp để trải nghiệm nhanh và không lưu trữ lâu dài. Người dùng được khuyến khích liên kết tài khoản Google hoặc tài khoản có mật khẩu để đảm bảo quyền lợi.',
        examples: [
          'Tài khoản Khách có thể bị thu hồi hoặc hết hạn phiên sau 7 ngày không hoạt động.',
          'Tài khoản chính thức được bảo vệ và có quyền lưu trữ dữ liệu vĩnh viễn.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Thông tin',
        penalty: 'Dữ liệu tạm của chế độ Khách sẽ tự động dọn dẹp khi hết hạn chu kỳ phiên làm việc.'
      }
    ]
  },

  // ==================== ĐIỀU 6 ====================
  {
    id: 'dieu-6',
    articleNumber: 'Điều 6',
    title: 'Hệ Thống Phân Cấp Vi Phạm, Biện Pháp Chế Tài & Cơ Chế Kháng Cáo',
    category: 'sanctions',
    categoryLabel: 'Chế Tài & Xử Phạt',
    summary: 'Minh bạch hóa các cấp độ vi phạm, quy trình xử lý kỹ thuật và quyền khiếu nại, kháng cáo công bằng cho người dùng.',
    subClauses: [
      {
        id: '6.1',
        clauseNumber: '6.1',
        title: 'Bốn cấp độ phân loại vi phạm trên toàn hệ thống',
        description: 'Mọi hành vi được phân loại khoa học làm 4 mức độ: Mức 1 (Nhẹ - Lỗi ngôn từ nhỏ), Mức 2 (Vừa - Lách luật, spam rác), Mức 3 (Cao - Kỳ thị, quấy rối, doxxing), Mức 4 (Nghiêm trọng đặc biệt - Đồi trụy, mã độc, lừa đảo).',
        examples: [
          'Mức 1: Cảnh cáo tự động, gắn dấu sao từ ngữ thô tục.',
          'Mức 2: Tạm khóa gửi tin, tạm ngắt kết nối P2P từ 1 đến 24 giờ.',
          'Mức 3: Khóa tài khoản và tính năng đám mây từ 3 đến 14 ngày.',
          'Mức 4: Khóa vĩnh viễn UID, chặn IP và chuyển giao hồ sơ nếu vi phạm hình sự.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Nguyên tắc',
        penalty: 'Áp dụng hình thức kỷ luật lũy tiến: vi phạm nhiều lần cùng một lỗi sẽ tự động tăng cấp độ phạt.'
      },
      {
        id: '6.2',
        clauseNumber: '6.2',
        title: 'Quy trình thu thập chứng cứ an ninh & Tự động ghi nhật ký (Audit Log)',
        description: 'Hệ thống tự động lưu trữ bằng chứng vi phạm dạng mã hóa (thời điểm, loại vi phạm, tệp tin nghi vấn, mã băm SHA-256) để phục vụ công tác thanh tra công bằng.',
        examples: [
          'Nhật ký chỉ phục vụ việc đối soát vi phạm và bảo vệ an toàn cho nạn nhân.',
          'Không sử dụng nhật ký an ninh cho bất kỳ mục đích thương mại nào.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Quy chuẩn',
        penalty: 'Bằng chứng ghi nhận trên hệ thống là căn cứ pháp lý cao nhất để bác bỏ các yêu cầu kháng cáo sai sự thật.'
      },
      {
        id: '6.3',
        clauseNumber: '6.3',
        title: 'Cơ chế kháng cáo công bằng & Thời hạn xét duyệt giải quyết',
        description: 'Nếu người dùng cho rằng tài khoản của mình bị xử lý nhầm lẫn bởi hệ thống AI tự động, người dùng có toàn quyền gửi đơn khiếu nại chính thức.',
        examples: [
          'Gửi khiếu nại tới kênh hỗ trợ chính thức: support@clsend.app (hoặc mục Kháng nghị trong Cài đặt).',
          'Cung cấp thông tin: UID thiết bị, thời điểm bị khóa, tệp tin hoặc nội dung bị báo cáo nhầm.',
          'Ban Quản Trị cam kết kiểm tra nhật ký thủ công và phản hồi kết quả trong vòng 24 - 48 giờ làm việc.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Quyền lợi người dùng',
        penalty: 'Nếu xác định hệ thống kiểm duyệt nhầm lẫn: Mở khóa ngay lập tức, khôi phục trạng thái và xóa điểm vi phạm oan.'
      }
    ]
  },

  // ==================== ĐIỀU 7 ====================
  {
    id: 'dieu-7',
    articleNumber: 'Điều 7',
    title: 'Miễn Trừ Trách Nhiệm & Hiệu Lực Thi Hành',
    category: 'legal',
    categoryLabel: 'Pháp Lý & Hiệu Lực',
    summary: 'Xác định ranh giới trách nhiệm giữa nền tảng và người sử dụng đối với các giao dịch truyền dữ liệu ngang hàng (P2P).',
    subClauses: [
      {
        id: '7.1',
        clauseNumber: '7.1',
        title: 'Giới hạn trách nhiệm đối với kênh truyền P2P phi tập trung',
        description: 'Kênh truyền P2P là kết nối trực tiếp thiết bị - tới - thiết bị thông qua công nghệ WebRTC. Dữ liệu truyền đi không đi qua máy chủ lưu trữ của ClSend. Do đó, người nhận có trách nhiệm tự kiểm tra độ an toàn của tệp tin trước khi mở.',
        examples: [
          'Luôn quét virus tệp tin nhận được từ người lạ trước khi mở trên máy tính.',
          'ClSend không chịu trách nhiệm đối với các mất mát tài chính do người dùng tự nguyện chuyển giao dữ liệu cá nhân cho bên thứ ba.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Quy định pháp lý',
        penalty: 'Người dùng tự chịu rủi ro khi đồng ý nhận tệp tin từ những người không quen biết.'
      },
      {
        id: '7.2',
        clauseNumber: '7.2',
        title: 'Quyền sửa đổi, cập nhật điều khoản & Thông báo thi hành',
        description: 'ClSend có quyền cập nhật, bổ sung các điều khoản này để phù hợp với sự phát triển của công nghệ và quy định pháp luật mới nhất. Mọi thay đổi lớn sẽ được công bố công khai trên ứng dụng.',
        examples: [
          'Thông báo phiên bản điều khoản cập nhật sẽ xuất hiện trên trang chính.',
          'Việc tiếp tục sử dụng ứng dụng sau khi cập nhật đồng nghĩa với việc bạn chấp thuận hoàn toàn điều khoản mới.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Hiệu lực',
        penalty: 'Nếu không đồng ý với điều khoản mới, người dùng có quyền ngừng sử dụng dịch vụ bất kỳ lúc nào.'
      },
      {
        id: '7.3',
        clauseNumber: '7.3',
        title: 'Cam kết tuân thủ của người dùng khi truy cập ClSend',
        description: 'Bằng việc nhấn "Đồng ý", đăng nhập hoặc tiếp tục sử dụng các dịch vụ gửi tệp, chat và lưu trữ của ClSend, người dùng cam kết đã đọc, hiểu rõ và tuyệt đối tuân thủ Bộ Luật Điều Khoản Sử Dụng này.',
        examples: [
          'Cam kết chung tay xây dựng cộng đồng chia sẻ tệp tin và trò chuyện văn minh, lành mạnh và an toàn.',
          'Sẵn sàng thông báo cho Ban Quản Trị khi phát hiện các hành vi vi phạm nghiêm trọng.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Cam kết danh dự & pháp lý',
        penalty: 'Mọi vi phạm đều sẽ được xử lý nghiêm minh theo đúng các điều khoản đã cam kết.'
      }
    ]
  }
];
