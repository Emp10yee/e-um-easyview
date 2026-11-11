import { createApp } from './app.mjs';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT는 0~65535 정수여야 합니다.');
const server = createApp();
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `포트 ${port}가 이미 사용 중입니다. 기존 서버를 종료하거나 PORT를 변경해 주세요.` : '개발 서버를 시작하지 못했습니다. 주소와 포트 설정을 확인해 주세요.');
  process.exitCode = 1;
});
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`EasyView: http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`));
