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
  }
];
