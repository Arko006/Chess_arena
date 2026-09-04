import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set({
    name: 'chessarena_auth',
    value: '',
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  response.cookies.set({
    name: 'chessarena_player_session',
    value: '',
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  return response;
}
