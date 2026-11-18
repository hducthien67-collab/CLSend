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
  category: 'speech' | 'file' | 'cloud' | 'privacy' | 'account' | 'sanctions' | 'legal' | 'data_protection' | 'dev';
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
  },

  // ==================== ĐIỀU 8 ====================
  {
    id: 'dieu-8',
    articleNumber: 'Điều 8',
    title: 'Tuân Thủ Pháp Luật Bảo Vệ Dữ Liệu Cá Nhân Việt Nam & Quốc Tế (NĐ 13/2023, GDPR, CCPA)',
    category: 'data_protection',
    categoryLabel: 'Luật Dữ Liệu VN & Quốc Tế',
    summary: 'Chọn lọc và chuẩn hóa các quy định cốt lõi từ Nghị định 13/2023/NĐ-CP, Luật An ninh mạng Việt Nam cùng GDPR (Châu Âu), CCPA/CPRA (Hoa Kỳ) và PDPA (Châu Á - Thái Bình Dương) nhằm bảo vệ tối đa quyền chủ thể dữ liệu.',
    subClauses: [
      {
        id: '8.1',
        clauseNumber: '8.1',
        title: 'Tuân thủ Nghị định 13/2023/NĐ-CP & Luật An ninh mạng Việt Nam',
        description: 'ClSend phân loại rõ Dữ liệu cá nhân cơ bản (tên hiển thị, username, email, SĐT, ngày sinh, giới tính, thiết bị) và Dữ liệu nhạy cảm (tệp riêng tư, tin nhắn, thông tin định vị phiên). Mọi hoạt động xử lý dữ liệu chỉ thực hiện trên cơ sở sự đồng ý tự nguyện, rõ ràng của người dùng và thông báo sự cố vi phạm dữ liệu (nếu có) trong vòng 72 giờ.',
        examples: [
          'Quyền được biết & Quyền đồng ý: Thông báo minh bạch mục đích trước khi thu thập Email, SĐT OTP hoặc hồ sơ Google/Facebook/GitHub.',
          'Quyền rút lại sự đồng ý: Người dùng có thể hủy liên kết tài khoản bên thứ ba hoặc ngừng cung cấp dữ liệu tùy chọn (Ngày sinh, Giới tính) bất kỳ lúc nào.',
          'Cấm tuyệt đối hành vi thu thập ngầm, ép buộc đồng ý hoặc lợi dụng không gian mạng xâm phạm an ninh quốc gia, trật tự an toàn xã hội.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Pháp luật Việt Nam',
        penalty: 'Mọi tài khoản hoặc công cụ thu thập trái phép dữ liệu người dùng Việt Nam sẽ bị khóa vĩnh viễn và lưu giữ nhật ký phối hợp xử lý theo pháp luật.'
      },
      {
        id: '8.2',
        clauseNumber: '8.2',
        title: 'Quyền Chủ thể Dữ liệu theo chuẩn Quốc tế (EU GDPR & APAC PDPA)',
        description: 'Áp dụng nguyên tắc Thu thập tối thiểu (Data Minimization) và Giới hạn mục đích (Purpose Limitation) theo Điều 5, 15, 16, 17 & 20 của GDPR cùng PDPA khu vực: Người dùng toàn quyền kiểm soát vòng đời dữ liệu của mình.',
        examples: [
          'Quyền Truy cập & Chỉnh sửa (GDPR Art. 15-16): Tự do xem, cập nhật tên hiển thị, Email, SĐT, Bio, ảnh đại diện trong phần Cài đặt.',
          'Quyền Được Quên / Xóa Dữ Liệu (GDPR Art. 17 - Right to Erasure): Quyền xóa tệp trên Cloud Drive, thu hồi phiên đăng nhập từ xa hoặc yêu cầu xóa hồ sơ tài khoản.',
          'Quyền Di chuyển Dữ liệu (GDPR Art. 20): Tải xuống bản gốc toàn bộ tệp tin cá nhân đã tải lên Cloud Drive không bị khóa định dạng.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Quyền lợi Quốc tế (GDPR)',
        penalty: 'Hệ thống cam kết thực thi tự động hoặc phản hồi yêu cầu truy cập/xóa dữ liệu hợp lệ trong vòng tối đa 72 giờ.'
      },
      {
        id: '8.3',
        clauseNumber: '8.3',
        title: 'Cam kết Không Mua Bán Dữ Liệu & Minh bạch Đăng nhập Bên thứ ba (CCPA/CPRA)',
        description: 'Theo chuẩn Đạo luật Quyền riêng tư Người tiêu dùng California (CCPA/CPRA): ClSend cam kết KHÔNG BÁN, KHÔNG CHO THUÊ và KHÔNG CHIA SẺ dữ liệu cá nhân của người dùng cho bất kỳ nhà môi giới dữ liệu hoặc mạng quảng cáo hành vi nào.',
        examples: [
          'Khi đăng nhập bằng Google, Facebook, GitHub hoặc SĐT OTP, hệ thống chỉ tiếp nhận trường định danh cơ bản tối thiểu (UID, Tên, Ảnh đại diện, Email/SĐT).',
          'Không phân biệt đối xử về tốc độ truyền P2P hay tính năng khi người dùng từ chối cung cấp các thông tin tùy chọn.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Chuẩn CCPA/CPRA',
        penalty: 'Nghiêm cấm mọi cá nhân, phòng ban hoặc thành viên lợi dụng nền tảng để rao bán, trao đổi danh sách Email/SĐT người dùng.'
      },
      {
        id: '8.4',
        clauseNumber: '8.4',
        title: 'Truyền Dữ liệu P2P Trực tiếp, Lưu trữ Tối thiểu & An toàn Xuyên biên giới',
        description: 'Dữ liệu truyền trực tiếp qua WebRTC P2P đi thẳng giữa hai thiết bị và không lưu trữ bản sao nội dung trên máy chủ trung gian. Dữ liệu đồng bộ đám mây được truyền tải qua kết nối mã hóa TLS/HTTPS và kiểm soát truy cập chặt chẽ.',
        examples: [
          'Phiên Khách (Guest) và dữ liệu tạm thời tự động hết hạn khi người dùng đăng xuất hoặc không hoạt động dài ngày.',
          'Nhật ký kiểm toán an ninh (Audit Log) chỉ lưu giữ tối thiểu phục vụ phòng chống mã độc, CSAM, lừa đảo và thực thi pháp luật hợp lệ.'
        ],
        severity: 'low',
        severityLabel: 'Mức độ: Tiêu chuẩn Hạ tầng',
        penalty: 'Dữ liệu vi phạm an ninh hoặc quá thời hạn lưu trữ tạm sẽ bị cô lập và tiêu hủy an toàn theo quy trình kỹ thuật.'
      }
    ]
  },

  // ==================== ĐIỀU 9 ====================
  {
    id: 'dieu-9',
    articleNumber: 'Điều 9',
    title: 'Quy Chuẩn Quyền Hạn, Đạo Đức & Trách Nhiệm Dành Cho Nhà Phát Triển & Quản Trị Viên (DEV)',
    category: 'dev',
    categoryLabel: 'Luật Dành Cho DEV',
    summary: 'Thiết lập ranh giới quyền lực công bằng hai chiều: Người dùng có quy tắc sử dụng thì Nhà phát triển (DEV) và Quản trị viên (Admin) cũng phải chịu sự ràng buộc nghiêm ngặt về đạo đức nghề nghiệp, quyền kiểm duyệt, bảo mật dữ liệu và trách nhiệm giải trình.',
    subClauses: [
      {
        id: '9.1',
        clauseNumber: '9.1',
        title: 'Cấm Lạm Quyền Kiểm Duyệt, Ban Tùy Tiện & Thiên Vị Cá Nhân',
        description: 'DEV và Quản trị viên chỉ được phép thực hiện thao tác Khóa/Hạn chế tài khoản (Ban thủ công) trong Datastore hoặc kiểm duyệt nội dung khi có bằng chứng vi phạm rõ ràng đối chiếu với Điều khoản sử dụng hoặc mối đe dọa bảo mật khẩn cấp.',
        examples: [
          'Cấm tuyệt đối Ban người dùng theo cảm tính, mâu thuẫn cá nhân, trả thù riêng hoặc bất đồng quan điểm không vi phạm luật.',
          'Mọi lệnh Ban hoặc Mở khóa (Unban) thủ công do DEV thực hiện bắt buộc phải ghi nhận lý do minh bạch và lưu dấu vết trong Audit Log.',
          'Không thiên vị hoặc miễn trừ xử phạt cho tài khoản quen biết nếu có hành vi phát tán mã độc, CSAM, lừa đảo hoặc quấy rối.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Ràng buộc DEV tuyệt đối',
        penalty: 'Mọi lệnh Ban sai quy định phải được thu hồi, mở khóa ngay lập tức; cá nhân lạm quyền bị tước bỏ quyền hạn DEV/Admin khỏi hệ thống.'
      },
      {
        id: '9.2',
        clauseNumber: '9.2',
        title: 'Nguyên Tắc Không Xâm Phạm Riêng Tư Dữ Liệu (Zero Snooping)',
        description: 'DEV có quyền truy cập hạ tầng kỹ thuật để duy trì hệ thống, nhưng bị NGHIÊM CẤM truy cập trái phép, xem trộm, sao chép, lưu trữ riêng hoặc phát tán tệp tin Cloud Drive, tin nhắn riêng tư và thông tin cá nhân của người dùng.',
        examples: [
          'Không tự ý đọc tin nhắn riêng, xem trộm tệp cá nhân hay trích xuất Email, SĐT, Ngày sinh từ Datastore ngoài mục đích kỹ thuật hợp lệ.',
          'Không bán, trao đổi hay chia sẻ danh sách người dùng cho bên thứ ba dưới bất kỳ hình thức nào.',
          'Chỉ truy xuất siêu dữ liệu (metadata) tối thiểu khi xử lý sự cố kỹ thuật, xác minh đơn kháng cáo hoặc theo yêu cầu hợp pháp.'
        ],
        severity: 'critical',
        severityLabel: 'Mức độ: Bảo mật tuyệt đối',
        penalty: 'Tước quyền truy cập Datastore vĩnh viễn và chịu trách nhiệm pháp lý theo Luật An ninh mạng & Nghị định 13/2023/NĐ-CP.'
      },
      {
        id: '9.3',
        clauseNumber: '9.3',
        title: 'Chuẩn Mực Giao Tiếp Văn Minh & Cấm Lạm Dụng Danh Nghĩa DEV',
        description: 'Quyền hạn kỹ thuật không đi kèm đặc quyền đứng trên nội quy cộng đồng. Khi giao tiếp trong phòng chat, tài khoản DEV vẫn phải tuân thủ chuẩn mực ngôn từ lịch sự, tôn trọng người dùng như mọi thành viên khác.',
        examples: [
          'Cấm dùng danh nghĩa hoặc huy hiệu DEV để hù dọa, hạ nhục, ép buộc người dùng cung cấp thông tin cá nhân hay mật khẩu.',
          'Không sử dụng chức năng gửi thông báo hệ thống để spam, quảng cáo cá nhân hoặc gây hoang mang cộng đồng.'
        ],
        severity: 'high',
        severityLabel: 'Mức độ: Đạo đức Quản trị',
        penalty: 'Cảnh cáo công khai, tạm đình chỉ quyền quản trị cộng đồng hoặc thu hồi vai trò DEV nếu tái phạm.'
      },
      {
        id: '9.4',
        clauseNumber: '9.4',
        title: 'Trách Nhiệm Minh Bạch, Sửa Sai Nhanh & Tiếp Nhận Khiếu Nại Công Tâm',
        description: 'DEV có nghĩa vụ bảo vệ công bằng cho người dùng trước sai sót kỹ thuật của AI hoặc con người, đồng thời chủ động vá lỗ hổng bảo mật và thông báo kịp thời khi thay đổi chính sách.',
        examples: [
          'Tiếp nhận và rà soát công tâm mọi đơn kháng cáo về án phạt AI/thủ công trong vòng 24 - 48 giờ làm việc.',
          'Nếu phát hiện khóa nhầm hoặc lỗi bộ lọc từ khóa, DEV phải Unban ngay lập tức và xóa bỏ điểm vi phạm oan cho người dùng.',
          'Công khai thông báo khi có cập nhật điều khoản lớn hoặc sự cố ảnh hưởng đến an toàn dữ liệu trong vòng 72 giờ.'
        ],
        severity: 'medium',
        severityLabel: 'Mức độ: Trách nhiệm giải trình',
        penalty: 'Buộc phải hoàn tác trạng thái tài khoản, xin lỗi và khắc phục lỗi kỹ thuật ngay khi có phản ánh xác thực.'
      }
    ]
  }
];

// ==================== ENGLISH OFFICIAL TERMS OF SERVICE ====================
export const OFFICIAL_TERMS_OF_SERVICE_EN: MainArticle[] = [
  // ==================== ARTICLE 1 ====================
  {
    id: 'dieu-1',
    articleNumber: 'Article 1',
    title: 'Communication Language & Conduct in Chat Rooms',
    category: 'speech',
    categoryLabel: 'Communication & Speech',
    summary: 'Applies to all public lounges, group P2P chat rooms, and direct messaging on the ClSend platform.',
    subClauses: [
      {
        id: '1.1',
        clauseNumber: '1.1',
        title: 'Defamation, Personal Insults & Harassment',
        description: 'Strictly prohibits all forms of vulgar language, humiliation, insults, or disparagement of the dignity, appearance, background, or family of other members.',
        examples: [
          'Aggressive cursing using vulgar slurs or offensive anatomical terms.',
          'Defaming personal honor or concocting baseless rumors to damage reputations.',
          'Using hate speech targeting communities, organizations, or demographic groups.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Medium',
        penalty: 'First warning: automated masking with ***; Repeat offenses: chat sending privileges temporarily revoked for 6 to 24 hours.'
      },
      {
        id: '1.2',
        clauseNumber: '1.2',
        title: 'Circumventing Moderation Filters & Disguised Profanity',
        description: 'Strictly prohibits intentionally inserting periods, underscores, spaces, special symbols, numbers replacing letters, or leetspeak to bypass automated AI moderation.',
        examples: [
          'Deliberately spaced or dotted text: f.u.c.k, s e x, b.i.t.c.h.',
          'Using numbers or alphanumeric substitutions: d1ck, 5ex, sh1t.',
          'Inserting unicode emojis or zero-width symbols between banned words.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Medium',
        penalty: 'Automated regex + AI detection filters the message immediately and records 1 violation point on the account.'
      },
      {
        id: '1.3',
        clauseNumber: '1.3',
        title: 'Regional Discrimination, Religious Hatred & Incitement',
        description: 'Strict adherence to Cybersecurity regulations: Strictly prohibits divisive speech, insults targeting regional cultures, religions, beliefs, ethnicities, or genders, and incitement to violence.',
        examples: [
          'Derogatory remarks targeting specific regional cultures, accents, or demographics.',
          'Blasphemous insults directed at religious beliefs, faiths, or spiritual symbols.',
          'Calling for harassment, ostracization, or violent acts against any group.'
        ],
        severity: 'high',
        severityLabel: 'Severity: High',
        penalty: 'Account suspension for 3 to 7 days; permanent ban for repeat offenses or severe incitement.'
      },
      {
        id: '1.4',
        clauseNumber: '1.4',
        title: 'Sexual Harassment, Unwanted Solicitation & Mental Coercion',
        description: 'Strictly prohibits crude sexual solicitations, coercing others into sharing private media, or persistently bothering others after they have declined.',
        examples: [
          'Demanding intimate photos or private media from other users.',
          'Vulgar or obscene sexual commentary about any member in the chat.',
          'Threatening violence, doxxing, or sending continuous harassing messages.'
        ],
        severity: 'high',
        severityLabel: 'Severity: High',
        penalty: 'Immediate P2P disconnection between devices and prohibition from joining public chat rooms for 48 to 72 hours.'
      },
      {
        id: '1.5',
        clauseNumber: '1.5',
        title: 'Message Spam, Gibberish Flooding & Room Congestion',
        description: 'Strictly prohibits flooding chat rooms with high-frequency messages, thousands of meaningless characters (Zalgo text, crash fonts) intended to lag or crash clients.',
        examples: [
          'Automated bot scripts dispatching dozens of messages per second.',
          'Sending deformed unicode characters causing client-side buffer overflows.',
          'Relentless spamming of sales pitches, promotional links, or referral URLs.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Medium',
        penalty: 'Rate limiting activated (30-second cooldown); temporary removal from the chat room for 1 hour.'
      }
    ]
  },

  // ==================== ARTICLE 2 ====================
  {
    id: 'dieu-2',
    articleNumber: 'Article 2',
    title: 'P2P Data Transmission & File Sharing Regulations',
    category: 'file',
    categoryLabel: 'Transmission & Files',
    summary: 'Defines safety standards across direct WebRTC P2P streams and Cloud Relay transit servers.',
    subClauses: [
      {
        id: '2.1',
        clauseNumber: '2.1',
        title: 'Strict Prohibition of Adult Content, Pornography & Child Exploitation (CSAM)',
        description: 'In accordance with International Conventions and Laws: STRICTLY PROHIBITS creating, transmitting, forwarding, or storing pornographic, sexually explicit material, or child sexual abuse material (CSAM).',
        examples: [
          'Circulating explicit images, nude videos, or adult media.',
          'Sharing links to adult file repositories or commercial adult archives.',
          'Any content depicting, suggesting, or relating to the exploitation of minors.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'IMMEDIATE PERMANENT BAN of device identifier; IP address blacklisted system-wide, and digital evidence preserved for legal authorities.'
      },
      {
        id: '2.2',
        clauseNumber: '2.2',
        title: 'Extreme Violence, Gore, Horror & Promotion of Self-Harm',
        description: 'Strictly prohibits sharing images of disfigured corpses, gory accidents without medical educational merit, cruel violence, suicide, self-harm, or terrorist propaganda.',
        examples: [
          'Footage of animal torture or brutal physical abuse of human beings.',
          'Tutorials on suicide, weapon fabrication, explosives, or hazardous toxins.',
          'Propaganda promoting violent extremist or terrorist organizations.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'Automated file blocking at transmission layer; account suspended for 7 days or permanently banned.'
      },
      {
        id: '2.3',
        clauseNumber: '2.3',
        title: 'Spreading Viruses, Malware, Trojans, Ransomware & Zip Bombs',
        description: 'Strictly prohibits transferring files containing spyware, keyloggers, ransomware, or malicious decompressed bombs (Zip Bombs) designed to harm recipients hardware or operating systems.',
        examples: [
          'Transmitting malicious executables (.exe, .scr, .bat, .vbs) disguised as office documents.',
          'Sending 42.zip or petabyte-expansion archive bombs intended to crash recipient machines.',
          'Embedding browser exploits into crafted HTML or SVG files.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'Permanent account ban; SHA-256 file hash submitted to network-wide destruction filter.'
      },
      {
        id: '2.4',
        clauseNumber: '2.4',
        title: 'Commercial Copyright Infringement & Malicious Cracked Software',
        description: 'Strictly prohibits sharing cracked software, fake keygens, or stolen copyrighted assets for illegal distribution over public channels.',
        examples: [
          'Sharing cracked software bundles laced with hidden crypto-miners.',
          'Leaking internal corporate databases, trade secrets, or unauthorized proprietary files.'
        ],
        severity: 'high',
        severityLabel: 'Severity: High',
        penalty: 'File removal and DMCA copyright notice; account ban on third repeat violation.'
      },
      {
        id: '2.5',
        clauseNumber: '2.5',
        title: 'Abusing P2P/Relay Channels for Denial-of-Service (DDoS) Attacks',
        description: 'Strictly prohibits deliberately opening thousands of concurrent dummy data streams (DataChannel Flood) to exhaust Relay bandwidth and degrade community connectivity.',
        examples: [
          'Scripts opening rapid loops of synthetic WebRTC connections.',
          'Flooding peers with maximum-size dummy packets to crash buffer memory.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'IP and device identifier blocked at cloud infrastructure level; permanent ban with no appeal.'
      }
    ]
  },

  // ==================== ARTICLE 3 ====================
  {
    id: 'dieu-3',
    articleNumber: 'Article 3',
    title: 'Cloud Storage & ClSend Cloud Drive Policies',
    category: 'cloud',
    categoryLabel: 'Cloud Storage Drive',
    summary: 'Defines storage quotas, data ownership, and security commitments on the ClSend Cloud Drive ecosystem.',
    subClauses: [
      {
        id: '3.1',
        clauseNumber: '3.1',
        title: 'Legal Ownership & Legal Responsibility for Stored Data',
        description: 'Users retain 100% copyright over files they upload. ClSend never reads, alters, or monetizes personal user data.',
        examples: [
          'Users bear sole legal liability before the law for the contents of files they store.',
          'ClSend provides encrypted cloud storage infrastructure adhering to modern industry standards.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Standard',
        penalty: 'Users assume full legal liability if their stored data violates applicable statutory laws.'
      },
      {
        id: '3.2',
        clauseNumber: '3.2',
        title: 'Storage Limits, File Sizes & Resource Management',
        description: 'Users must use cloud storage properly without attempting to exploit loopholes to exceed provisioned storage quotas or uploading millions of 0KB junk files.',
        examples: [
          'Refraining from spam scripts uploading junk records to exhaust cloud storage databases.',
          'Complying with supported file extensions and single-file upload size limits.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Medium',
        penalty: 'Automated cleanup of abnormal junk files and upload speed throttle if abuse is detected.'
      },
      {
        id: '3.3',
        clauseNumber: '3.3',
        title: 'End-to-End Encryption & Key Management Responsibility',
        description: 'Data is client-side encrypted before pushing to the cloud. Users must retain their own passwords and PINs; ClSend cannot recover data if secret keys are lost.',
        examples: [
          'Safeguarding account credentials and never sharing sync PIN codes with untrusted third parties.',
          'Periodically backing up mission-critical data to local storage drives.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Advisory',
        penalty: 'ClSend assumes no liability for data loss caused by unauthorized disclosure of passwords or encryption keys.'
      },
      {
        id: '3.4',
        clauseNumber: '3.4',
        title: 'Takedown & Destruction Procedure for Dangerous Files',
        description: 'If cloud-stored files contain critical malware or prohibited items as determined by law, ClSend reserves the right to quarantine and destroy them without prior notice.',
        examples: [
          'Files flagged with Red Alert severity by antivirus scanning networks.',
          'Files subject to official seizure or takedown orders issued by cybersecurity authorities.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'Immediate destruction of offending files and revocation of Cloud Drive privileges for the account.'
      }
    ]
  },

  // ==================== ARTICLE 4 ====================
  {
    id: 'dieu-4',
    articleNumber: 'Article 4',
    title: 'Privacy Protection, Personal Data & Anti-Doxxing',
    category: 'privacy',
    categoryLabel: 'Privacy Protection',
    summary: 'Guarantees the inviolability of private life, personal secrets, and identity security for all platform participants.',
    subClauses: [
      {
        id: '4.1',
        clauseNumber: '4.1',
        title: 'Strict Prohibition of Unauthorized Identity Disclosure (Doxxing)',
        description: 'Strictly prohibits publishing or circulating personally identifiable information (PII) of others in public chats or sending files containing private records without written consent.',
        examples: [
          'Sharing national identity cards, passports, or driver licenses of other individuals.',
          'Disclosing private phone numbers, physical residential addresses, or workplaces.',
          'Exposing private banking credentials, financial balances, or transaction records.'
        ],
        severity: 'high',
        severityLabel: 'Severity: High',
        penalty: 'Immediate removal of infringing records; account suspended from 7 days to permanently depending on impact.'
      },
      {
        id: '4.2',
        clauseNumber: '4.2',
        title: 'Non-Consensual Recording & Leaking Private Conversations',
        description: 'Strictly prohibits screenshotting or recording private P2P messages or private transmissions to distribute externally for extortion or defamation.',
        examples: [
          'Capturing confidential chat logs to publicly ridicule participants on external social networks.',
          'Using private conversation records for extortion, ransom demands, or blackmail.'
        ],
        severity: 'high',
        severityLabel: 'Severity: High',
        penalty: 'Chat room access revoked; incident logs released upon official legal request.'
      },
      {
        id: '4.3',
        clauseNumber: '4.3',
        title: 'Cyber Espionage, Tracking Scripts & Auth Token Theft',
        description: 'Strictly prohibits sending malicious scripts, phishing links designed to steal session tokens, or browser tracking probes.',
        examples: [
          'Spoofing account login portals to deceive users into submitting passwords.',
          'Sending IP logger links designed to surreptitiously capture real IP addresses or coordinates.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'Permanent account ban; attacker domains and IP ranges entered into automated blocklists.'
      }
    ]
  },

  // ==================== ARTICLE 5 ====================
  {
    id: 'dieu-5',
    articleNumber: 'Article 5',
    title: 'Account Management, Device Identity & 6-Digit PIN Sync',
    category: 'account',
    categoryLabel: 'Account & Identity',
    summary: 'Defines user account protection obligations, fast 6-digit sync mechanisms, and user duties when using services.',
    subClauses: [
      {
        id: '5.1',
        clauseNumber: '5.1',
        title: 'Duty to Safeguard Passwords, 6-Digit PIN & Login QR Codes',
        description: 'Each account is bound to a device ID and credentials. Users must keep this confidential and never disclose 6-digit synchronization PINs to strangers.',
        examples: [
          'The login QR code and 6-digit synchronization PIN grant full access to account resources.',
          'ClSend administrators will never solicit your sync PIN or credentials via chat.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Caution',
        penalty: 'Users bear full responsibility if carelessly sharing PIN codes resulting in data loss.'
      },
      {
        id: '5.2',
        clauseNumber: '5.2',
        title: 'Impersonating Administrators, Developers or System Accounts',
        description: 'Strictly prohibits setting display names, avatars, or sending messages pretending to be ClSend Administrators, Developers, or System alerts.',
        examples: [
          'Using deceptive display names such as "ClSend Admin", "Official Moderator", or "Dev Support".',
          'Posing as technical staff demanding password handovers or claiming penalty fines.',
          'Falsifying developer verification badges to intimidate novice users.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Critical',
        penalty: 'Immediate permanent ban; display name revoked and added to permanent blacklisted keywords.'
      },
      {
        id: '5.3',
        clauseNumber: '5.3',
        title: 'Automated Bot Tools & Mass Dummy Account Creation',
        description: 'Strictly prohibits automated bot tools, crawlers, or spammers to register mass dummy accounts to disrupt platform infrastructure.',
        examples: [
          'Running automated scripts generating hundreds of guest tokens per minute.',
          'Using bot crawlers to indiscriminately scrape cloud files without authorization.'
        ],
        severity: 'high',
        severityLabel: 'Severity: High',
        penalty: 'Firewall blocks entire IP ranges; instant purge of all generated dummy accounts.'
      },
      {
        id: '5.4',
        clauseNumber: '5.4',
        title: 'Guest Mode Policies vs. Verified Accounts',
        description: 'Guest Mode provides quick ephemeral access without persistent retention. Users are advised to link a Google or password-protected account.',
        examples: [
          'Guest sessions may expire or cycle out after 7 days of inactivity.',
          'Verified accounts retain persistent Cloud Drive storage and full profile customizability.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Informational',
        penalty: 'Guest session temporary data automatically expires and cleans up after lifecycle termination.'
      }
    ]
  },

  // ==================== ARTICLE 6 ====================
  {
    id: 'dieu-6',
    articleNumber: 'Article 6',
    title: 'Sanctions Hierarchy, Enforcement Measures & Appeals',
    category: 'sanctions',
    categoryLabel: 'Sanctions & Penalties',
    summary: 'Transparently outlines violation levels, technical intervention processes, and fair complaint and appeal procedures.',
    subClauses: [
      {
        id: '6.1',
        clauseNumber: '6.1',
        title: 'Four Progressive Violation Levels Across the Platform',
        description: 'All infractions are classified into 4 tiers: Tier 1 (Minor - vulgarity), Tier 2 (Moderate - evasion, spam), Tier 3 (High - harassment, discrimination, doxxing), Tier 4 (Critical - CSAM, malware, fraud).',
        examples: [
          'Tier 1: Automated warning, profanity masking with asterisks.',
          'Tier 2: Messaging freeze, temporary P2P transmission suspension from 1 to 24 hours.',
          'Tier 3: Account and cloud access restricted for 3 to 14 days.',
          'Tier 4: Permanent device UID ban, IP exclusion, and legal evidence handover if criminal.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Policy',
        penalty: 'Progressive discipline: repeating the same offense automatically elevates to higher penalty tiers.'
      },
      {
        id: '6.2',
        clauseNumber: '6.2',
        title: 'Security Evidence Collection & Audit Logging',
        description: 'Systems automatically store encrypted violation evidence (timestamp, infraction type, suspect file, SHA-256 hash) for fair verification.',
        examples: [
          'Audit logs strictly serve to verify violations and safeguard potential victims.',
          'Security logs are never monetized or utilized for third-party commercial profiling.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Standard',
        penalty: 'System audit logs serve as primary legal evidence to evaluate claims.'
      },
      {
        id: '6.3',
        clauseNumber: '6.3',
        title: 'Fair Appeal Mechanism & Resolution Timeframe',
        description: 'If a user believes their account was mistakenly restricted by automated AI systems, they have the right to file an official appeal.',
        examples: [
          'Submit appeals to the official support channel: support@clsend.app.',
          'Include relevant identifiers: device UID, timestamp of restriction, and the flagged content.',
          'The moderation committee reviews records manually and issues a response within 24 - 48 business hours.'
        ],
        severity: 'low',
        severityLabel: 'Severity: User Rights',
        penalty: 'If verified as a false positive: immediate unban, status restored, and wrongful violation marks erased.'
      }
    ]
  },

  // ==================== ARTICLE 7 ====================
  {
    id: 'dieu-7',
    articleNumber: 'Article 7',
    title: 'Disclaimer of Liability & Legal Enforcement',
    category: 'legal',
    categoryLabel: 'Legal & Enforcement',
    summary: 'Delineates responsibilities between the platform and users for peer-to-peer (P2P) data transfers.',
    subClauses: [
      {
        id: '7.1',
        clauseNumber: '7.1',
        title: 'Liability Limitations for Decentralized P2P Data Channels',
        description: 'P2P data channels are direct device-to-device connections via WebRTC. Data does not transit through ClSend storage servers. Recipients are responsible for inspecting file safety.',
        examples: [
          'Always scan received executable files or archives for malware before opening.',
          'ClSend assumes no liability for financial damages caused by voluntarily disclosing private credentials.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Legal Policy',
        penalty: 'Users accept inherent risks when accepting files from unknown peers.'
      },
      {
        id: '7.2',
        clauseNumber: '7.2',
        title: 'Right to Amend, Update Terms & Notification of Changes',
        description: 'ClSend reserves the right to revise these terms to reflect technological advances and statutory changes. Material updates will be announced in-app.',
        examples: [
          'Notices of terms revisions will appear prominently across the application portal.',
          'Continued usage of the service following revisions constitutes binding acceptance of the updated terms.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Validity',
        penalty: 'Users who disagree with revised terms may discontinue service usage at any time.'
      },
      {
        id: '7.3',
        clauseNumber: '7.3',
        title: 'User Compliance Commitment Upon Accessing ClSend',
        description: 'By clicking "Accept", signing in, or using file sending, chat, or storage, users confirm they have read, understood, and agreed to adhere to these Terms of Service.',
        examples: [
          'Pledging to build a respectful, secure, and civil digital file-sharing and messaging community.',
          'Alerting platform moderators promptly when detecting severe abuses or security threats.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Legal Agreement',
        penalty: 'All infractions will be strictly handled in accordance with these committed terms.'
      }
    ]
  },

  // ==================== ARTICLE 8 ====================
  {
    id: 'dieu-8',
    articleNumber: 'Article 8',
    title: 'Vietnam & International Personal Data Protection Compliance (Decree 13/2023, GDPR, CCPA)',
    category: 'data_protection',
    categoryLabel: 'VN & Global Data Laws',
    summary: 'Selectively adopts core standards from Vietnam Decree 13/2023/ND-CP on Personal Data Protection, Vietnam Cybersecurity Law 2018, EU GDPR, CCPA/CPRA, and APAC PDPA to safeguard user data rights.',
    subClauses: [
      {
        id: '8.1',
        clauseNumber: '8.1',
        title: 'Vietnam Personal Data Protection (Decree 13/2023/ND-CP & Cybersecurity Law)',
        description: 'ClSend clearly distinguishes Basic Personal Data (display name, username, email, phone, date of birth, gender, device info) from Sensitive Data (private files, E2EE messages, session location). Data processing relies on explicit, informed user consent with 72-hour data breach notification obligations.',
        examples: [
          'Right to be Informed & Consent: Clear notice before collecting Email, SMS OTP Phone, or Google/Facebook/GitHub identity fields.',
          'Right to Withdraw Consent: Users may unlink third-party providers or omit optional profile fields (DOB, Gender) at any time.',
          'Strictly prohibits covert scraping, coerced consent, or unlawful collection violating national cybersecurity standards.'
        ],
        severity: 'high',
        severityLabel: 'Severity: Vietnam Law Compliance',
        penalty: 'Accounts or bots performing unauthorized data harvesting will be permanently banned with audit logs preserved for legal cooperation.'
      },
      {
        id: '8.2',
        clauseNumber: '8.2',
        title: 'International Data Subject Rights (EU GDPR & APAC PDPA)',
        description: 'Follows Data Minimization and Purpose Limitation principles under GDPR Articles 5, 15, 16, 17 & 20 and regional PDPA frameworks, giving users transparent control over their data lifecycle.',
        examples: [
          'Right of Access & Rectification (GDPR Art. 15-16): View and update display name, Email, Phone, Bio, and avatar in Settings.',
          'Right to Erasure / Right to be Forgotten (GDPR Art. 17): Delete Cloud Drive files, revoke active login sessions, or request account deletion.',
          'Right to Data Portability (GDPR Art. 20): Download original uploaded files from Cloud Drive anytime without vendor lock-in.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Global Rights (GDPR)',
        penalty: 'Valid access, correction, or erasure requests are fulfilled automatically or reviewed within 72 hours.'
      },
      {
        id: '8.3',
        clauseNumber: '8.3',
        title: 'Zero Sale of Personal Data & Third-Party OAuth Transparency (CCPA/CPRA)',
        description: 'Aligned with CCPA/CPRA standards: ClSend NEVER sells, rents, or trades user personal information to data brokers or cross-context behavioral advertising networks.',
        examples: [
          'Signing in via Google, Facebook, GitHub, or Phone OTP requests only minimal identity fields (UID, Name, Avatar, Email/Phone).',
          'No degraded P2P transfer speed or discrimination against users who withhold optional profile details.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: CCPA/CPRA Standard',
        penalty: 'Strictly prohibits any user or party from trading, selling, or soliciting user Email/Phone lists on the platform.'
      },
      {
        id: '8.4',
        clauseNumber: '8.4',
        title: 'Direct P2P Transit, Retention Limits & Cross-Border Safeguards',
        description: 'Direct WebRTC P2P streams travel device-to-device without storing file payloads on relay servers. Cloud synchronization uses TLS/HTTPS encryption, strict access controls, and bounded retention periods.',
        examples: [
          'Ephemeral Guest sessions and temporary artifacts are automatically purged upon logout or inactivity expiration.',
          'Security audit logs are strictly retained only to prevent malware, CSAM, fraud, and satisfy lawful judicial orders.'
        ],
        severity: 'low',
        severityLabel: 'Severity: Infrastructure Standard',
        penalty: 'Expired ephemeral records and security-flagged payloads are securely isolated and purged.'
      }
    ]
  },

  // ==================== ARTICLE 9 ====================
  {
    id: 'dieu-9',
    articleNumber: 'Article 9',
    title: 'Developer & Administrator Code of Conduct, Authority Limits & Accountability',
    category: 'dev',
    categoryLabel: 'DEV Code of Conduct',
    summary: 'Establishes two-way fairness: Just as users follow platform rules, Developers (DEV) and Administrators are strictly bound by moderation ethics, privacy boundaries, non-abuse of power, and transparent accountability.',
    subClauses: [
      {
        id: '9.1',
        clauseNumber: '9.1',
        title: 'Prohibition of Moderation Abuse, Arbitrary Bans & Personal Bias',
        description: 'DEVs and Administrators may only issue manual account bans or restrictions in Datastore based on verifiable violations of Terms of Service or urgent security threats.',
        examples: [
          'Strictly prohibits banning users out of personal grudges, emotion, retaliation, or lawful disagreements.',
          'Every manual Ban or Unban performed by a DEV must include a clear, factual reason recorded in the Audit Log.',
          'No favoritism or immunity may be granted to acquaintances who distribute malware, CSAM, scams, or harass others.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Absolute DEV Constraint',
        penalty: 'Wrongful bans must be lifted immediately; offending personnel have DEV/Admin privileges permanently revoked.'
      },
      {
        id: '9.2',
        clauseNumber: '9.2',
        title: 'Zero Snooping & Strict Data Confidentiality Obligations',
        description: 'DEVs maintain infrastructure strictly for reliability and safety, and are ABSOLUTELY FORBIDDEN from peeking at, copying, downloading, or leaking user Cloud Drive files, private chats, or personal info.',
        examples: [
          'Never inspect private messages, personal files, or extract Email, Phone, or Birth Date from Datastore for personal curiosity.',
          'Never sell, trade, or disclose user directories or metadata to unauthorized third parties.',
          'Access only minimal technical metadata when resolving bugs, verifying user appeals, or complying with lawful orders.'
        ],
        severity: 'critical',
        severityLabel: 'Severity: Strict Confidentiality',
        penalty: 'Immediate revocation of Datastore access and legal liability under applicable data protection statutes.'
      },
      {
        id: '9.3',
        clauseNumber: '9.3',
        title: 'Respectful Conduct & Ban on Exploiting DEV Status',
        description: 'Technical authority does not place DEVs above community standards. In public chat rooms, DEV accounts must uphold respectful, civil communication alongside regular users.',
        examples: [
          'Never use DEV badges or authority to intimidate, demean, or coerce users into handing over passwords or personal data.',
          'Never abuse system broadcast tools for spam, personal promotion, or causing public panic.'
        ],
        severity: 'high',
        severityLabel: 'Severity: Governance Ethics',
        penalty: 'Formal warning, suspension of moderation privileges, or removal of DEV role upon repeat violation.'
      },
      {
        id: '9.4',
        clauseNumber: '9.4',
        title: 'Transparency, Prompt Bug Remediation & Impartial Appeal Review',
        description: 'DEVs are obligated to protect users from automated AI false positives or human errors, patch vulnerabilities swiftly, and disclose major policy or security updates transparently.',
        examples: [
          'Review user appeals regarding AI or manual sanctions impartially within 24 - 48 business hours.',
          'If a false positive or mistaken ban is confirmed, unban immediately and erase wrongful violation marks.',
          'Notify users transparently regarding major Terms updates or verified data security incidents within 72 hours.'
        ],
        severity: 'medium',
        severityLabel: 'Severity: Accountability',
        penalty: 'Mandatory rollback of wrongful penalties and prompt remediation of confirmed moderation or security defects.'
      }
    ]
  }
];

// ==================== 简体中文官方服务条款 ====================
export const OFFICIAL_TERMS_OF_SERVICE_ZH: MainArticle[] = [
  // ==================== 第 1 条 ====================
  {
    id: 'dieu-1',
    articleNumber: '第 1 条',
    title: '聊天室交流语言与行为规范',
    category: 'speech',
    categoryLabel: '交流与言语',
    summary: '适用于 ClSend 平台上的所有公共大厅、P2P 群聊室以及直接文本消息交流。',
    subClauses: [
      {
        id: '1.1',
        clauseNumber: '1.1',
        title: '诽谤名誉、人身侮辱与骚扰',
        description: '严禁任何使用粗俗语言、贬低、辱骂或诋毁其他成员尊严、外貌、背景或家庭的行为。',
        examples: [
          '使用粗鄙脏话或涉及人体敏感部位的攻击性词汇进行辱骂。',
          '捏造毫无根据的谣言诋毁他人名誉或破坏他人声誉。',
          '对特定群体、机构或社区使用仇恨言论。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：中',
        penalty: '首次警告：系统自动将敏感词屏蔽为 ***；屡犯者将暂停发言权限 6 至 24 小时。'
      },
      {
        id: '1.2',
        clauseNumber: '1.2',
        title: '故意规避审核过滤器与伪装脏话',
        description: '严禁故意插入句号、下划线、空格、特殊符号、数字替代字母或火星文以绕过 AI 自动审核系统。',
        examples: [
          '故意拆开或加点拼写：f.u.c.k、s e x、b.i.t.c.h。',
          '使用数字或字符替换字母：d1ck、5ex、sh1t。',
          '在违禁词中间插入特殊 Unicode 字符或表情符号。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：中',
        penalty: '正则与 AI 自动识别后立即拦截过滤，并在账号内记入 1 次违规记录。'
      },
      {
        id: '1.3',
        clauseNumber: '1.3',
        title: '地域歧视、宗教仇恨与暴力煽动',
        description: '严格遵守网络安全法规：严禁发表分裂地域文化、侮辱宗教信仰、民族或性别的言论及煽动暴力的内容。',
        examples: [
          '针对特定地区文化、口音或人群发表贬损性言论。',
          '亵渎他人宗教信仰、信条或精神象征。',
          '号召对任何群体实施排挤、霸凌或暴力行为。'
        ],
        severity: 'high',
        severityLabel: '严重程度：高',
        penalty: '封禁账号 3 至 7 天；屡犯或严重煽动者永久封禁。'
      },
      {
        id: '1.4',
        clauseNumber: '1.4',
        title: '性骚扰、不当搭讪与精神胁迫',
        description: '严禁发送粗俗性挑逗、强迫他人提供私密媒体或在对方明确拒绝后仍持续骚扰。',
        examples: [
          '向其他用户索要私密照片或私人敏感视频。',
          '对聊天室内任何成员的身体发表下流、淫秽评论。',
          '威胁实施暴力、人肉搜索或连续发送骚扰信息。'
        ],
        severity: 'high',
        severityLabel: '严重程度：高',
        penalty: '立即断开双方设备之间的 P2P 连接，并在 48 至 72 小时内禁止加入公共聊天室。'
      },
      {
        id: '1.5',
        clauseNumber: '1.5',
        title: '消息刷屏、乱码轰炸与频道拥堵',
        description: '严禁高频率发送海量消息或数千个无意义变形字符（如 Zalgo 文本、崩溃字体），意图导致他人客户端卡顿或崩溃。',
        examples: [
          '使用自动化脚本每秒发送数十条消息。',
          '发送异常 Unicode 字符造成客户端缓冲区溢出。',
          '持续发送垃圾广告、推销话术或推广返佣链接。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：中',
        penalty: '触发频率限制（30 秒冷却）；暂时移出聊天室 1 小时。'
      }
    ]
  },

  // ==================== 第 2 条 ====================
  {
    id: 'dieu-2',
    articleNumber: '第 2 条',
    title: 'P2P 数据传输与文件共享规范',
    category: 'file',
    categoryLabel: '传输与文件',
    summary: '规定 WebRTC P2P 直连传输流与 Cloud Relay 中转服务器的安全标准。',
    subClauses: [
      {
        id: '2.1',
        clauseNumber: '2.1',
        title: '严禁成人内容、色情及儿童性剥削内容 (CSAM)',
        description: '依据国际公约及相关法律：绝对禁止制作、传输、转发或存储色情、淫秽资料或儿童性剥削与虐待材料 (CSAM)。',
        examples: [
          '传播露骨图片、裸露视频或成人色情媒体。',
          '分享色情资源库链接或成人内容压缩包。',
          '任何描绘、暗示或涉及剥削未成年人的内容。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '立即永久封禁账号及关联邮箱/手机号；全系统拉黑并保全数字证据以移交执法机关。'
      },
      {
        id: '2.2',
        clauseNumber: '2.2',
        title: '极端暴力、血腥恐怖与教唆自残',
        description: '严禁分享非医学教育用途的残缺遗体图像、血腥事故现场、虐待暴行、自杀自残引导或恐怖主义宣传材料。',
        examples: [
          '虐待动物或对人类施以残酷暴行的影像。',
          '自杀方法、武器制造、爆炸物或剧毒物质的制作教程。',
          '宣传暴力极端组织或恐怖主义的材料。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '在传输层自动拦截文件；账号封禁 7 天至永久封禁。'
      },
      {
        id: '2.3',
        clauseNumber: '2.3',
        title: '传播病毒、木马、勒索软件与压缩包炸弹',
        description: '严禁传输包含间谍软件、键盘记录器、勒索病毒或旨在破坏接收方硬件与操作系统的恶意压缩炸弹 (Zip Bomb)。',
        examples: [
          '伪装成办公文档发送恶意可执行文件 (.exe, .scr, .bat, .vbs)。',
          '发送 42.zip 或解压后膨胀至 PB 级的炸弹压缩包致使对方电脑崩溃。',
          '在 HTML 或 SVG 文件中嵌入浏览器漏洞利用代码。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '永久封禁账号；将文件 SHA-256 哈希加入全网拦截销毁清单。'
      },
      {
        id: '2.4',
        clauseNumber: '2.4',
        title: '侵犯商业版权与恶意破解软件',
        description: '严禁在公共渠道分享破解软件、虚假注册机或盗窃受版权保护的商业资产用于非法分发。',
        examples: [
          '分享捆绑隐蔽挖矿木马的破解软件包。',
          '泄露企业或机构内部数据库、商业机密或未授权专有文件。'
        ],
        severity: 'high',
        severityLabel: '严重程度：高',
        penalty: '移除文件并发送 DMCA 版权警告；累计三次违规将封禁账号。'
      },
      {
        id: '2.5',
        clauseNumber: '2.5',
        title: '滥用 P2P/Relay 通道发起拒绝服务 (DDoS) 攻击',
        description: '严禁故意同时开启数千条虚假数据通道 (DataChannel Flood) 以耗尽中继带宽并破坏社区连接稳定性。',
        examples: [
          '运行脚本连续高频建立虚假 WebRTC 连接。',
          '向对端发送超大垃圾数据包以耗尽接收缓冲区内存。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '在云基础设施层封锁相关访问来源；涉事账号永久封禁且不可申诉。'
      }
    ]
  },

  // ==================== 第 3 条 ====================
  {
    id: 'dieu-3',
    articleNumber: '第 3 条',
    title: '云端存储与 ClSend Cloud Drive 管理规范',
    category: 'cloud',
    categoryLabel: '云盘存储',
    summary: '明确 ClSend Cloud Drive 生态内的存储配额、数据所有权与安全承诺。',
    subClauses: [
      {
        id: '3.1',
        clauseNumber: '3.1',
        title: '存储数据的合法所有权与法律责任',
        description: '用户对其上传的文件拥有 100% 的著作权与所有权。ClSend 绝不会擅自偷窥、篡改或商业化利用用户私人数据。',
        examples: [
          '用户对其存储文件的内容依法承担唯一法律责任。',
          'ClSend 提供符合现代云计算安全标准的加密云存储基础设施。'
        ],
        severity: 'low',
        severityLabel: '严重程度：标准规范',
        penalty: '若存储内容违反适用法律法规，由用户自行承担全部法律责任。'
      },
      {
        id: '3.2',
        clauseNumber: '3.2',
        title: '存储限额、文件大小与资源合理使用',
        description: '用户须合理使用云存储空间，不得利用漏洞突破配额限制或恶意上传数百万个 0KB 垃圾文件。',
        examples: [
          '不得使用刷单脚本上传垃圾记录以耗尽云端数据库资源。',
          '遵守平台允许的文件格式及单文件大小限制。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：中',
        penalty: '系统自动清理异常垃圾文件，并在检测到滥用行为时限制上传速率。'
      },
      {
        id: '3.3',
        clauseNumber: '3.3',
        title: '端到端加密与密钥保管责任',
        description: '数据在推送至云端前已在浏览器本地完成加密处理。用户须妥善保管个人密码与同步 PIN 码；若密钥遗失，ClSend 无法找回数据。',
        examples: [
          '妥善保管账号凭据，切勿向陌生人泄露 6 位同步 PIN 码。',
          '定期将重要资料备份至个人本地存储设备。'
        ],
        severity: 'low',
        severityLabel: '严重程度：安全建议',
        penalty: '因用户自行泄露密码或解密密钥导致的数据丢失，ClSend 不承担赔偿责任。'
      },
      {
        id: '3.4',
        clauseNumber: '3.4',
        title: '危险文件的下架与销毁流程',
        description: '若云盘文件经检测包含高危恶意程序或依法严禁传播的内容，ClSend 有权在不事先通知的情况下立即隔离并销毁。',
        examples: [
          '被病毒扫描系统标记为红色高危警报的文件。',
          '收到网络安全监管部门依法下达的下架或查封指令的文件。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '立即销毁违规文件并撤销该账号的 Cloud Drive 使用权限。'
      }
    ]
  },

  // ==================== 第 4 条 ====================
  {
    id: 'dieu-4',
    articleNumber: '第 4 条',
    title: '隐私保护、个人数据安全与反人肉搜索',
    category: 'privacy',
    categoryLabel: '隐私保护',
    summary: '保障平台所有参与者的私人生活、个人秘密与身份信息不可侵犯。',
    subClauses: [
      {
        id: '4.1',
        clauseNumber: '4.1',
        title: '严禁未经授权泄露他人身份信息 (Doxxing)',
        description: '严禁在未经书面许可的情况下，在公共聊天室发布或通过文件传播他人的个人身份识别信息 (PII)。',
        examples: [
          '公开他人的身份证、护照或驾驶证等证件照片。',
          '泄露他人的私人手机号、家庭住址或工作学校地址。',
          '曝光他人银行账号、资金余额或交易明细记录。'
        ],
        severity: 'high',
        severityLabel: '严重程度：高',
        penalty: '立即移除违规信息；视对受害者造成的影响封禁账号 7 天至永久封禁。'
      },
      {
        id: '4.2',
        clauseNumber: '4.2',
        title: '未经同意偷拍录屏与泄露私密对话',
        description: '严禁私下截图或录制私密 P2P 对话及传输内容并向外部传播，用于羞辱或敲诈勒索。',
        examples: [
          '截取私密聊天记录并发布到社交平台对当事人进行公开羞辱。',
          '利用私密对话内容威胁、勒索钱财或胁迫他人。'
        ],
        severity: 'high',
        severityLabel: '严重程度：高',
        penalty: '撤销聊天室访问权限；如有法定机关调查需求，依法配合提供事件日志。'
      },
      {
        id: '4.3',
        clauseNumber: '4.3',
        title: '网络间谍行为、追踪脚本与登录令牌窃取',
        description: '严禁发送恶意脚本、旨在窃取登录会话令牌 (Auth Token) 的钓鱼链接或浏览器隐蔽追踪探针。',
        examples: [
          '伪造 Google 或平台登录界面欺骗用户输入账号密码。',
          '发送用于暗中采集用户真实 IP 地址或地理位置的 IP 记录链接。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '永久封禁账号；将攻击者域名及来源纳入自动封锁名单。'
      }
    ]
  },

  // ==================== 第 5 条 ====================
  {
    id: 'dieu-5',
    articleNumber: '第 5 条',
    title: '账号管理、设备标识与 6 位 PIN 码同步规范',
    category: 'account',
    categoryLabel: '账号与身份',
    summary: '明确用户账号保护义务、6 位快速同步机制及使用服务时的个人责任。',
    subClauses: [
      {
        id: '5.1',
        clauseNumber: '5.1',
        title: '妥善保管密码、6 位同步 PIN 码与登录二维码的义务',
        description: '每个账号均与身份凭据及同步机制关联，用户有义务严格保密，切勿向陌生人提供 6 位同步 PIN 码。',
        examples: [
          '登录二维码和 6 位同步 PIN 码代表直接访问账号资源的钥匙。',
          'ClSend 管理员绝不会通过任何聊天消息向您索要同步 PIN 码或密码。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：安全提醒',
        penalty: '因个人疏忽将 PIN 码透露给他人导致的数据损失，由用户自行承担责任。'
      },
      {
        id: '5.2',
        clauseNumber: '5.2',
        title: '严禁冒充管理员、开发者或系统官方账号',
        description: '严禁将昵称、头像或发送的消息伪装成 ClSend 管理员、开发人员或官方系统通知。',
        examples: [
          '使用“ClSend Admin”、“官方版主”、“Dev Support”等误导性名称。',
          '冒充技术人员要求用户交出密码或缴纳所谓罚款。',
          '伪造开发者认证标识威吓新用户。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：极其严重',
        penalty: '立即永久封禁账号；收回昵称并将相关关键词列入永久黑名单。'
      },
      {
        id: '5.3',
        clauseNumber: '5.3',
        title: '自动化脚本工具 (Bot) 与批量注册虚假账号',
        description: '严禁使用自动化机器人、爬虫或垃圾软件批量注册虚假账号以扰乱或消耗平台资源。',
        examples: [
          '运行自动化脚本每分钟生成数百个虚假访客令牌。',
          '使用爬虫工具未经授权扫描抓取云端存储文件。'
        ],
        severity: 'high',
        severityLabel: '严重程度：高',
        penalty: '防火墙拦截异常来源并立即清除所有批量生成的虚假账号。'
      },
      {
        id: '5.4',
        clauseNumber: '5.4',
        title: '访客模式 (Guest) 与正式账号规则',
        description: '访客模式仅供快速临时体验，不作长期保存承诺；建议绑定邮箱、手机号或 Google 账号以保障完整权益。',
        examples: [
          '访客会话在长期无活动后可能会过期清理。',
          '正式绑定账号享有持久云盘存储与完整跨端数据同步权限。'
        ],
        severity: 'low',
        severityLabel: '严重程度：说明信息',
        penalty: '访客模式临时数据将在会话生命周期结束后自动清理。'
      }
    ]
  },

  // ==================== 第 6 条 ====================
  {
    id: 'dieu-6',
    articleNumber: '第 6 条',
    title: '违规分级、处罚执行与申诉机制',
    category: 'sanctions',
    categoryLabel: '处罚与制裁',
    summary: '公开透明地说明违规分级、技术处置流程及公正的申诉复核途径。',
    subClauses: [
      {
        id: '6.1',
        clauseNumber: '6.1',
        title: '全平台四级违规分类标准',
        description: '所有违规行为科学划分为四级：一级（轻微-不当用语）、二级（中度-绕过过滤与刷屏）、三级（高危-骚扰歧视与泄露隐私）、四级（极其严重-涉黄赌毒/恶意软件/诈骗）。',
        examples: [
          '一级：系统自动警告并用星号 *** 遮蔽脏话。',
          '二级：冻结消息发送、暂停 P2P 传输 1 至 24 小时。',
          '三级：限制账号及云服务功能 3 至 14 天。',
          '四级：永久封禁涉事账号及其绑定的同邮箱/同手机号账号，若涉及违法犯罪则移交证据。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：执行原则',
        penalty: '采用累进处罚机制：重复犯同一错误将自动升级至更严厉的惩罚等级。'
      },
      {
        id: '6.2',
        clauseNumber: '6.2',
        title: '安全取证与审计日志记录 (Audit Log)',
        description: '系统自动对违规证据进行加密归档（时间、违规类型、可疑文件、SHA-256 哈希值），以便进行公正审核。',
        examples: [
          '审计日志仅用于核实违规事实并保护受害者安全。',
          '绝不将安全日志用于任何第三方商业画像或盈利目的。'
        ],
        severity: 'low',
        severityLabel: '严重程度：技术规范',
        penalty: '系统记录的安全审计日志将作为核实申诉请求的核心依据。'
      },
      {
        id: '6.3',
        clauseNumber: '6.3',
        title: '公正申诉机制与处理时效',
        description: '若用户认为账号遭到 AI 自动审核系统误判限制，完全有权提出正式申诉。',
        examples: [
          '向官方支持渠道提交申诉：support@clsend.app。',
          '提供相关标识信息：账号 UID、被封禁时间及被误判的内容说明。',
          '管理团队承诺人工核查日志并在 24 至 48 个工作小时内给予答复。'
        ],
        severity: 'low',
        severityLabel: '严重程度：用户权益',
        penalty: '经核实确属误判的：立即解除封禁、恢复账号状态并清除误记违规记录。'
      }
    ]
  },

  // ==================== 第 7 条 ====================
  {
    id: 'dieu-7',
    articleNumber: '第 7 条',
    title: '免责声明与条款生效执行',
    category: 'legal',
    categoryLabel: '法律与生效',
    summary: '界定平台与用户在点对点 (P2P) 数据传输过程中的权责边界。',
    subClauses: [
      {
        id: '7.1',
        clauseNumber: '7.1',
        title: '去中心化 P2P 传输通道的责任限制',
        description: 'P2P 数据通道通过 WebRTC 在设备间直接传输，数据不经过 ClSend 存储服务器。接收方在打开文件前须自行核实文件安全性。',
        examples: [
          '打开来自陌生人发送的可执行程序或压缩包前，请务必进行病毒查杀。',
          '因用户自愿向第三方泄露私人凭据而导致的财产损失，ClSend 不承担责任。'
        ],
        severity: 'low',
        severityLabel: '严重程度：法律条款',
        penalty: '用户同意接收未知来源文件时须自行承担相应风险。'
      },
      {
        id: '7.2',
        clauseNumber: '7.2',
        title: '条款修订、更新权及变更通知',
        description: 'ClSend 有权根据技术演进与最新法律法规对本条款进行修订与补充，重要变更将在应用内显著公布。',
        examples: [
          '条款版本更新通知将在应用首页及法律门户中显示。',
          '在条款更新后继续使用本服务，即视为您完全接受修订后的新条款。'
        ],
        severity: 'low',
        severityLabel: '严重程度：效力说明',
        penalty: '若不同意新修订的条款，用户可随时停止使用本服务。'
      },
      {
        id: '7.3',
        clauseNumber: '7.3',
        title: '访问 ClSend 时的用户合规承诺',
        description: '点击“同意”、登录或继续使用 ClSend 的文件传输、聊天与存储服务，即表示用户已阅读、理解并承诺严格遵守本使用条款。',
        examples: [
          '承诺共同建设文明、安全、健康的数字文件分享与即时通讯社区。',
          '发现严重违规或安全威胁时及时向平台管理员举报。'
        ],
        severity: 'low',
        severityLabel: '严重程度：法律承诺',
        penalty: '所有违规行为均将严格按照本承诺条款处理。'
      }
    ]
  },

  // ==================== 第 8 条 ====================
  {
    id: 'dieu-8',
    articleNumber: '第 8 条',
    title: '越南及国际个人数据保护法合规标准（第 13/2023 号法令、GDPR、CCPA）',
    category: 'data_protection',
    categoryLabel: '越南与国际数据法',
    summary: '精选并融合越南第 13/2023/NĐ-CP 号个人数据保护法令、越南《网络安全法》以及欧盟 GDPR、美国 CCPA/CPRA 与亚太 PDPA 核心规范，全面保障用户数据主权。',
    subClauses: [
      {
        id: '8.1',
        clauseNumber: '8.1',
        title: '遵守越南个人数据保护法令 (NĐ 13/2023/NĐ-CP) 与《网络安全法》',
        description: 'ClSend 明确区分基本个人数据（昵称、用户名、邮箱、手机号、出生日期、性别、设备信息）与敏感个人数据（私人文件、端到端加密消息、登录会话区域）。所有数据处理均须基于用户明确、自愿的同意，并在发生数据安全事件时履行 72 小时内通报义务。',
        examples: [
          '知情权与明示同意：在绑定邮箱、手机短信 OTP 或 Google/Facebook/GitHub 授权前清晰告知用途。',
          '撤回同意权：用户可随时解除第三方账号关联，或拒绝填写出生日期、性别等可选项。',
          '严禁暗中抓取数据、强迫授权或从事危害网络安全与公共秩序的数据收集行为。'
        ],
        severity: 'high',
        severityLabel: '严重程度：越南法律合规',
        penalty: '任何非法采集用户数据的账号或脚本将被永久封禁，并保留日志依法配合监管部门处置。'
      },
      {
        id: '8.2',
        clauseNumber: '8.2',
        title: '国际数据主体权利标准（欧盟 GDPR 与亚太 PDPA）',
        description: '严格遵循 GDPR 第 5、15、16、17、20 条及亚太 PDPA 的“最小化收集”与“目的限制”原则，赋予用户完整的数据生命周期控制权。',
        examples: [
          '访问与更正权 (GDPR Art. 15-16)：随时在“设置”中查看、修改昵称、邮箱、手机号、简介与头像。',
          '删除权 / 被遗忘权 (GDPR Art. 17)：随时删除 Cloud Drive 文件、注销远程登录会话或申请彻底删除账号档案。',
          '数据可携权 (GDPR Art. 20)：随时下载您上传至云盘的原始文件，无任何格式锁定限制。'
        ],
        severity: 'low',
        severityLabel: '严重程度：国际标准 (GDPR)',
        penalty: '合法的数据查询、更正与删除请求将在系统内即时执行或于 72 小时内审核完成。'
      },
      {
        id: '8.3',
        clauseNumber: '8.3',
        title: '承诺绝不出售个人数据与第三方登录透明原则 (CCPA/CPRA)',
        description: '依据加州消费者隐私法 (CCPA/CPRA) 标准：ClSend 承诺绝不向任何数据经纪商或跨平台广告追踪网络出售、出租或共享用户个人数据。',
        examples: [
          '使用 Google、Facebook、GitHub 或手机号验证码登录时，仅读取必要的最小身份字段（UID、昵称、头像、邮箱/手机）。',
          '不会因用户拒绝填写可选个人资料而降低 P2P 传输速率或限制核心服务体验。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：CCPA/CPRA 标准',
        penalty: '严禁任何用户或机构利用平台倒卖、传播他人邮箱或手机号码列表。'
      },
      {
        id: '8.4',
        clauseNumber: '8.4',
        title: 'P2P 直连不留存、最短存储期限与跨境传输加密保护',
        description: 'WebRTC P2P 通道在设备间点对点直接传输，文件内容不经由中转服务器留存；云端同步数据全程采用 TLS/HTTPS 加密与严格的权限隔离机制。',
        examples: [
          '访客会话 (Guest) 及临时凭证在退出登录或长期未活动后自动过期清理。',
          '安全审计日志仅在防范恶意软件、CSAM、欺诈及依法配合执法机关所需的最小期限内保存。'
        ],
        severity: 'low',
        severityLabel: '严重程度：基础设施标准',
        penalty: '超期临时数据及安全隔离文件将按技术规范安全销毁。'
      }
    ]
  },

  // ==================== 第 9 条 ====================
  {
    id: 'dieu-9',
    articleNumber: '第 9 条',
    title: '开发者与管理员权限规范、职业道德及问责条款 (DEV)',
    category: 'dev',
    categoryLabel: '开发者规范',
    summary: '建立双向公平机制：正如用户须遵守社区规则，开发者 (DEV) 与管理员同样必须严格遵守权限边界、禁止滥用职权、严守用户数据隐私并履行公正纠错义务。',
    subClauses: [
      {
        id: '9.1',
        clauseNumber: '9.1',
        title: '严禁滥用审核权力、随意封号及个人偏袒',
        description: 'DEV 与管理员仅在核实存在违反服务条款的真实证据或紧急安全威胁时，方可在后台执行手动封禁 (Ban) 或功能限制。',
        examples: [
          '严禁因个人恩怨、情绪化、报复心理或正常意见分歧而随意封禁用户账号。',
          'DEV 执行的每一项手动封禁 (Ban) 或解封 (Unban) 操作均须填写明确理由并记入审计日志 (Audit Log)。',
          '不得包庇或豁免传播恶意软件、CSAM、诈骗或骚扰他人的熟人账号。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：DEV 绝对红线',
        penalty: '违规误封须立即撤销解封；滥用职权者将被永久撤销 DEV/管理员权限。'
      },
      {
        id: '9.2',
        clauseNumber: '9.2',
        title: '严禁窥探用户隐私与数据保密义务 (Zero Snooping)',
        description: 'DEV 仅可在系统维护与安全防护范围内操作基础设施，绝对禁止偷窥、下载、复制、私存或泄露用户的云盘文件、私密聊天记录及个人身份信息。',
        examples: [
          '不得擅自查阅私人消息、偷看个人文件，或因非正当技术理由从后台导出用户邮箱、手机号及出生日期。',
          '严禁向任何第三方出售、交换或泄露用户资料名单。',
          '仅在排查故障、人工复核申诉或依法配合监管核查时调取最小限度的技术元数据。'
        ],
        severity: 'critical',
        severityLabel: '严重程度：绝对保密',
        penalty: '立即吊销后台数据访问权限，并依法承担相应的数据安全法律责任。'
      },
      {
        id: '9.3',
        clauseNumber: '9.3',
        title: '文明表率准则与严禁借 DEV 身份施压',
        description: '技术管理权限并不赋予高于社区规则的特权。在公共聊天室互动时，DEV 账号同样须遵守文明礼貌用语规范。',
        examples: [
          '严禁利用 DEV 徽章或管理身份恐吓、贬低或胁迫用户提供密码及个人敏感信息。',
          '不得滥用系统公告功能发送垃圾广告、个人推广或制造社区恐慌。'
        ],
        severity: 'high',
        severityLabel: '严重程度：管理伦理',
        penalty: '给予公开警告、暂停社区管理权限，屡犯者取消 DEV 身份标识。'
      },
      {
        id: '9.4',
        clauseNumber: '9.4',
        title: '透明披露、及时纠错与公正复核申诉责任',
        description: 'DEV 有义务保障用户免受 AI 自动误判或人工失误的侵害，及时修复安全漏洞，并透明公开重大条款或安全事件变更。',
        examples: [
          '在 24 至 48 个工作小时内公正受理并人工复核用户针对 AI 或手动封禁的申诉。',
          '一旦确认误判或误封，DEV 必须立即解除封禁 (Unban) 并清除误记违规记录。',
          '发生重大条款更新或确认的数据安全事件时，须在 72 小时内向受影响用户透明通报。'
        ],
        severity: 'medium',
        severityLabel: '严重程度：问责与纠错',
        penalty: '经查实确属误判或失职的，须立即恢复用户账号状态并修复相关技术缺陷。'
      }
    ]
  }
];

