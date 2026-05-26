import React, { Component, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../lib/theme'
import { captureException } from '../lib/sentry'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: any) {
    captureException(error, { componentStack: info?.componentStack })
    console.error('ErrorBoundary caught:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Ionicons name="warning" size={64} color={colors.error} />
            <Text style={styles.title}>Oups ! Quelque chose s'est mal passé</Text>
            <Text style={styles.message}>
              Une erreur inattendue s'est produite. Tu peux réessayer ou recharger l'application.
            </Text>
            <View style={styles.buttons}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={this.handleRetry}>
                <Ionicons name="refresh" size={20} color={colors.white} />
                <Text style={styles.buttonTextPrimary}>Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buttonSecondary} onPress={this.handleReload}>
                <Text style={styles.buttonTextSecondary}>Recharger l'app</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  buttons: {
    gap: 12,
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonTextPrimary: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondary: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonTextSecondary: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
})