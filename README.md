# RefSite

Thư viện resource cá nhân cho design và development. Giao diện dark theo `DESIGN (4).md` (LaunchDarkly): canvas Midnight Ink `#0e0e0e`, panel Carbon `#191919`, chữ trắng/Fog, CTA Voltage Blue `#405bff` và điểm nhấn Signal Violet `#7084ff`. Font tự host Geist và Geist Mono là các lựa chọn thay thế trong tài liệu; tiêu đề weight 500, nhãn kỹ thuật dùng mono. Thanh điều hướng nổi bo 60px, card/nút/tag bo 30px, input bo 10px, viền white-alpha và glow violet nhẹ. Bỏ minh hoạ pastel của theme trước; ảnh resource gốc được giữ nguyên, bìa mặc định là panel sáng. Lưới ba cột trên màn hình rộng, hai cột trên desktop nhỏ, một cột trên mobile và chế độ danh sách thu gọn. Vùng nội dung tối đa 1200px; khoảng cách được điều chỉnh cho ứng dụng thư viện.

## Chạy local

Yêu cầu Node.js 22.13+ (khuyến nghị Node 24 LTS) và npm.

```powershell
cd D:\RefSite
npm.cmd install
npm.cmd run dev
```

Mở **http://localhost:3000**. Nếu terminal báo cổng khác, dùng đúng URL terminal hiển thị.

Không cần tài khoản Supabase để chạy thử. Khi chưa có biến môi trường Supabase, `npm run dev` dùng file **`D:\RefSite\data\library.json`**, được tạo khi lưu dữ liệu lần đầu. Có bản trước lần ghi gần nhất tại `library.json.bak`. Dừng/mở server không mất dữ liệu. Mọi thiết bị truy cập **cùng server này** sử dụng chung file dữ liệu, không lưu resource trong localStorage.

Thư viện ban đầu trống và có sẵn các thư mục Product Design, Visual Design, Development, Uncategory. Nút **“Hoặc khám phá với 8 resource mẫu”** nạp mẫu khi bạn muốn thử giao diện.

### Mở trên điện thoại trong cùng Wi-Fi

1. Giữ `npm.cmd run dev` đang chạy trên máy tính.
2. Chạy `ipconfig` trên máy tính, tìm IPv4 của adapter Wi-Fi/Ethernet đang dùng, ví dụ `192.168.1.20`.
3. Trên điện thoại cùng mạng, mở `http://192.168.1.20:3000`.
4. Nếu Windows hỏi quyền cho Node.js, cho phép trên **Private networks**. Không dùng chế độ local không đăng nhập trên Internet hoặc mạng công cộng.

Truy cập đa thiết bị qua Internet cần kết nối Supabase **và** deploy ứng dụng Next.js. Supabase lưu dữ liệu/đăng nhập, không tự host phần frontend Next.js của dự án này.

## Những gì đã có

- Thêm/sửa/xoá resource: tên, URL, mô tả, ảnh bìa dạng URL, thư mục, tag, yêu thích.
- Dán URL và rời ô nhập để tự đọc metadata; thao tác tự động không ghi đè những trường đã nhập tay. Bấm nút sparkle để chủ động lấy lại và thay thế tên, mô tả, ảnh bìa bằng thông tin từ website. Website không hỗ trợ metadata vẫn lưu được.
- Bìa ưu tiên Open Graph/Twitter metadata; nếu thiếu hoặc ảnh hỏng sẽ dùng bìa chữ. Đây là ảnh do website khai báo, **không phải ảnh chụp giao diện website**. Ảnh được tham chiếu bằng URL, chưa lưu bản sao vào Storage.
- Sidebar thư mục cha/con nhiều cấp: thêm, đổi tên, chuyển thư mục cha, sắp xếp lên/xuống trong form chỉnh sửa, xoá. Chưa có kéo thả.
- **Uncategory** cố định, không sửa/xoá. Resource trong thư mục bị xoá (gồm thư mục con) được chuyển về đây.
- **Ctrl+K / Cmd+K** mở tìm kiếm tên, URL, mô tả, tag; hỗ trợ tiếng Việt không dấu. Mũi tên lên/xuống chọn kết quả, Enter mở link, Esc đóng. Trên mobile chạm kính lúp.
- Grid/list, lọc tag, sắp xếp theo thời gian hoặc tên, Favorites, xuất/nhập JSON.
- Nhập dữ liệu theo kiểu **gộp**, bỏ qua link trùng và giữ bản đang có. Không ghi đè thư viện hiện tại.
- Mỗi lần ghi kiểm tra revision để tránh một thiết bị ghi đè thay đổi mới từ thiết bị khác. Làm mới khi quay lại tab và mỗi 30 giây khi tab đang mở. Đây chưa phải realtime/offline sync.

## Blog cá nhân

Mục **Blog** thay cho My workspace trên sidebar. Bài viết dùng cùng nơi lưu và quyền truy cập của thư viện; không có trang công khai hay thao tác xuất bản. Với Supabase, bài viết và ảnh nằm trong document JSONB của tài khoản, được bảo vệ bằng RLS hiện có. Không cần chạy thêm SQL. Chế độ local vẫn dùng quyền truy cập của server local như mô tả ở trên.

- Viết, đọc, sửa bài; tìm theo tiêu đề, nội dung, tag (hỗ trợ tiếng Việt không dấu); lọc tag và sắp xếp theo lần cập nhật gần nhất.
- Tiêu đề trong trình sửa tự xuống dòng và tăng chiều cao theo nội dung, kể cả khi đổi kích thước cửa sổ.
- Ctrl/Cmd+Z hoàn tác; Ctrl+Y hoặc Ctrl/Cmd+Shift+Z làm lại. Lịch sử chung cho tiêu đề, tag, văn bản, định dạng, ảnh và thao tác khối; có thêm nút Hoàn tác/Làm lại. Giữ tối đa 100 bước trong phiên chỉnh sửa, gom các lần gõ liên tiếp; tự lưu không xóa lịch sử. Rời trình sửa hoặc tải lại trang bắt đầu một lịch sử mới.
- Gõ `/` trong một khối để chọn đoạn văn, H1–H4, danh sách, checklist, trích dẫn, code, đường phân cách hoặc ảnh. Dùng mũi tên và Enter để chọn, Esc đóng menu. Nút `+` cạnh khối cũng mở menu.
- Bấm tay nắm chấm đầu dòng để mở cùng menu định dạng, giữ nguyên chữ và định dạng trong dòng khi đổi giữa đoạn văn/H1–H4/danh sách/trích dẫn. Có thể dùng phím mũi tên/Enter/Esc trong popup; kéo tay nắm vẫn sắp xếp khối như trước.
- Bôi đen văn bản trong khối để mở thanh định dạng: đậm, nghiêng, gạch chân, gạch ngang, mã trong dòng, tô sáng và liên kết. Hỗ trợ Ctrl/Cmd+B, I, U; liên kết chỉ nhận HTTP, HTTPS hoặc mailto. Định dạng giữ nguyên khi tự lưu, mở lại, đọc bài và sao lưu JSON. Bài cũ không cần chuyển đổi dữ liệu.
- Enter tạo khối tiếp theo và giữ định dạng ở hai phía con trỏ; Shift+Enter xuống dòng trong khối. Backspace ở đầu đoạn nối với đoạn trước. Khối code giữ Enter để viết nhiều dòng. Kéo tay nắm cạnh khối tới vạch chỉ vị trí để sắp xếp; có nút lên/xuống và Alt+↑/↓ khi focus tay nắm, phù hợp cả bàn phím và điện thoại.
- Chèn ảnh bằng chọn file, kéo thả đúng vị trí trước/sau khối hoặc dán từ clipboard tại khối đang viết; thêm chú thích ngay dưới ảnh. Ảnh được nén thành WebP, cạnh dài tối đa 1.600 px; GIF được lưu thành ảnh tĩnh. Ảnh gốc tối đa 15 MB, ảnh sau nén tối đa 2 MB, mỗi bài tối đa 6 MB.
- Tự lưu sau 800 ms ngừng nhập; có trạng thái lưu và Ctrl/Cmd+S. Chuyển mục hoặc rời trình sửa sẽ chờ lưu; nếu lỗi thì giữ bản đang sửa. Đóng/tải lại tab khi còn thay đổi sẽ có cảnh báo trình duyệt. Đây chưa phải trình sửa offline: hãy xuất Markdown nếu mất kết nối kéo dài.
- Xoá đưa bài vào **Thùng rác**, có thể khôi phục; chưa có xoá vĩnh viễn. Mỗi bài có phiên bản riêng để ngăn một bản sửa cũ ghi đè thay đổi trên thiết bị khác.
- Chế độ đọc có mục lục khi có ít nhất hai heading. Nút tải xuống xuất Markdown kèm định dạng và ảnh nhúng; gạch chân/tô sáng dùng thẻ HTML `u`/`mark`, cần trình đọc Markdown cho phép HTML để hiển thị hai kiểu này.
- Xuất/nhập thư viện JSON bao gồm bài viết, ảnh và thùng rác. Nhập gộp theo ID bài viết, giữ bản đang có; file thư viện cũ không có Blog vẫn dùng được. Giới hạn nhập JSON hiện tại là 10 MB; bản sao nhiều ảnh nên lưu thêm Markdown từng bài.

Kiểm thử API trên một bản build và thư mục dữ liệu tạm, không dùng cấu hình tài khoản thật:

```powershell
npx tsx tests/blog-api.integration.ts
```

Kiểm thử thêm thao tác trên Chrome headless (cần Chrome trên máy), bao gồm định dạng, tách/nối đoạn, menu `/`, kéo thả, ba cách chèn ảnh, tải lại bài, lưu thất bại/thử lại và bố cục điện thoại:

```powershell
$env:REFSITE_TEST_BROWSER='1'
npx tsx tests/blog-api.integration.ts
```

Ảnh chụp kiểm thử được ghi vào `test-results/blog-editor-*.png`. Bộ kiểm thử chạy với bản sao ứng dụng và dữ liệu tạm, không dùng `.env.local` hay thư viện thật.

## Kết nối Supabase sau khi chạy thử

### 1. Xuất dữ liệu local trước

Trong RefSite, mở **Cài đặt thư viện → Xuất thư viện**. Giữ file JSON này để nhập vào chế độ Supabase. File local vẫn được giữ lại khi đổi chế độ.

### 2. Tạo project và bảng dữ liệu

1. Tạo project tại https://supabase.com/dashboard.
2. Mở **SQL Editor**, tạo query mới.
3. Dán toàn bộ nội dung `supabase/schema.sql`, bấm **Run**.

Schema tạo bảng `refsite_libraries` và bật **Row Level Security**. RefSite dùng một document JSONB cho thư viện cá nhân để lưu cả cây thư mục và resource nguyên tử. Database vẫn là PostgreSQL. Tìm kiếm chạy trên dữ liệu thư viện đã tải; chưa dùng Postgres full-text search. Cách này phù hợp thư viện cá nhân; giới hạn hiện tại là 10.000 resource, 500 thư mục, file import tối đa 10 MB.

### 3. Tạo đúng tài khoản của bạn và cấp thư viện

1. Vào **Authentication → Users → Add user → Create new user** (tên nút có thể thay đổi theo dashboard).
2. Nhập email và mật khẩu của bạn; xác nhận email/Auto Confirm nếu dashboard cho chọn.
3. Trong phần cấu hình Authentication, tắt **Allow new users to sign up** để giữ ứng dụng riêng tư.
4. Quay lại SQL Editor, thay email rồi chạy:

```sql
insert into public.refsite_libraries (user_id)
select id from auth.users
where lower(email) = lower('email-cua-ban@example.com')
on conflict (user_id) do nothing;
```

Kiểm tra thư viện được cấp đúng tài khoản:

```sql
select u.email, l.revision
from public.refsite_libraries l
join auth.users u on u.id = l.user_id;
```

Ứng dụng không có trang đăng ký. Quyền database chỉ cho đọc/sửa thư viện được cấp sẵn; không cho client tự tạo thư viện, xoá thư viện hoặc đổi chủ sở hữu.

### 4. Thêm biến môi trường

Trong dashboard project, lấy **Project URL** và **Publishable key** từ **Connect / API Keys / Project Settings**. Không dùng key `service_role` hoặc secret key.

Tại `D:\RefSite`, sao chép file mẫu:

```powershell
Copy-Item .env.example .env.local
```

Chỉ chạy lệnh copy khi chưa có `.env.local`, tránh ghi đè cấu hình đang dùng. Mở `.env.local` và điền:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
REFSITE_ALLOW_LOCAL=false
```

Cả hai giá trị phải có đủ. Publishable key được phép xuất hiện ở browser; quyền riêng tư được thực thi bằng đăng nhập và RLS. `.env.local` đã nằm trong `.gitignore`.

### 5. Khởi động lại và nhập dữ liệu

1. Dừng server bằng `Ctrl+C`, chạy lại `npm.cmd run dev`.
2. Mở RefSite, đăng nhập bằng tài khoản vừa tạo.
3. Mở **Cài đặt thư viện → Nhập thư viện**, chọn file JSON đã xuất, kiểm tra số lượng rồi bấm **Nhập dữ liệu**.
4. Thử thêm một resource, mở RefSite trên thiết bị khác và đăng nhập cùng tài khoản. Tải lại trang hoặc chờ chu kỳ đồng bộ.

Nếu hiện “Tài khoản này chưa được cấp thư viện”, kiểm tra bước SQL cấp thư viện đúng user. Nếu không đọc được database, kiểm tra schema, URL, key và kết nối. Ứng dụng không tự chuyển về dữ liệu local khi cấu hình Supabase lỗi.

### 6. Dùng qua Internet khi bạn sẵn sàng

Deploy project dưới dạng **Next.js có server Node.js**, ví dụ trên Vercel hoặc server riêng. Thêm hai biến `NEXT_PUBLIC_SUPABASE_*` vào môi trường deploy trước khi build. Giữ `REFSITE_ALLOW_LOCAL=false`; không deploy thư mục `data/`.

Khi đã deploy, dùng cùng URL HTTPS trên laptop và mobile. Chế độ đăng nhập hiện tại là email/password, chưa dùng magic link hoặc OAuth redirect. Nếu đổi mật khẩu, dùng dashboard Supabase; UI quên mật khẩu chưa được triển khai.

## Cấu trúc source

```text
src/app/                    Next.js App Router, CSS và API routes
src/components/             Giao diện thư viện, form, dialog
src/lib/model.ts            Validation, search, thao tác thư mục/resource/import
src/lib/local-store.ts      Đọc/ghi JSON local, lock, atomic rename, bản .bak
src/lib/backend.ts          Chọn local hoặc Supabase và kiểm tra đăng nhập
src/lib/metadata.ts         Đọc HTML công khai và trích Open Graph
supabase/schema.sql         Schema, quyền database và RLS
tests/                      Kiểm thử dữ liệu, ghi đồng thời, metadata
data/                       Dữ liệu local phát sinh, không đưa vào Git
```

## Kiểm tra và production local

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Chạy bản production trên mạng nội bộ khi **chưa** nối Supabase:

```powershell
$env:REFSITE_ALLOW_LOCAL = 'true'
npm.cmd start
```

Local mode không yêu cầu đăng nhập; mọi thiết bị trong mạng có thể truy cập URL nếu firewall cho phép. Chỉ dùng trong mạng tin cậy. Khi cần riêng tư qua Internet, dùng Supabase.

Nếu máy tắt đột ngột trong lúc ghi và ứng dụng báo đang được ghi mãi: dừng **tất cả** tiến trình RefSite, kiểm tra sao lưu `data/library.json.bak`, rồi xoá **thư mục rỗng** `data/.write-lock` trước khi khởi động lại. Không sửa file JSON khi server đang chạy. Bản `.bak` chỉ giữ lần ghi trước, nên xuất JSON định kỳ cho các mốc quan trọng.

## Tài liệu tham khảo

- https://nextjs.org/docs/app
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://ogp.me/
