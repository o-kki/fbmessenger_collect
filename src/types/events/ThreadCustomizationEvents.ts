import { MessageEvent } from '../Events'

export interface ChangeThreadNicknameEvent extends MessageEvent {
  participantId: string
  nickname: string
}

export interface ChangeThreadThemeEvent extends MessageEvent {
  color: string
}

export interface ChangeThreadIconEvent extends MessageEvent {
  threadIcon: string
  threadIconURL: string
}
