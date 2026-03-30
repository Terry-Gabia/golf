const errorMap: Record<string, string> = {
  'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 메일을 확인해주세요.',
  'User already registered': '이미 가입된 이메일입니다.',
  'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
  'Signup requires a valid password': '유효한 비밀번호를 입력해주세요.',
  'Unable to validate email address: invalid format': '올바른 이메일 형식이 아닙니다.',
  'Email rate limit exceeded': '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  'For security purposes, you can only request this once every 60 seconds':
    '보안을 위해 60초에 한 번만 요청할 수 있습니다.',
  'New password should be different from the old password.':
    '새 비밀번호는 이전 비밀번호와 달라야 합니다.',
  'Auth session missing!': '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
}

export function translateError(message: string): string {
  return errorMap[message] || message
}
