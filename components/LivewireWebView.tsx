import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';

interface LivewireWebViewProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
  email: string;
  action: 'signup' | 'forgot-password';
  trigger: boolean;
}

export default function LivewireWebView({ 
  onSuccess, 
  onError, 
  email, 
  action, 
  trigger 
}: LivewireWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReadyRef = useRef(false);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    if (trigger) {
      console.log('[LivewireWebView] Trigger activated, resetting state...');
      setHasSubmitted(false);
      setIsReady(false);
      setWebViewKey(prev => prev + 1);
      
      timeoutRef.current = setTimeout(() => {
        console.log('[LivewireWebView] Timeout reached!');
        onError('Connection timeout. Please check your internet and try again.');
      }, 30000);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [trigger, onError]);

  const baseUrl = action === 'signup' 
    ? 'https://uservault.net/auth/signup' 
    : 'https://uservault.net/auth/forgot-password';

  const successPattern = useMemo(() => 
    action === 'signup' 
      ? /signup-success\/([^\/\?]+)/ 
      : /forgot-success\/([^\/\?]+)/
  , [action]);

  const injectedJavaScript = `
    (function() {
      var checkCount = 0;
      var maxChecks = 50;
      
      function findEmailInput() {
        var emailInput = document.querySelector('input[type="email"]') || 
                          document.querySelector('input[name="emailAddress"]') ||
                          document.querySelector('input[name="email"]');
        
        if (!emailInput) {
          var allInputs = document.querySelectorAll('input');
          for (var i = 0; i < allInputs.length; i++) {
            var inp = allInputs[i];
            var wireModel = inp.getAttribute('wire:model') || 
                            inp.getAttribute('wire:model.live') || 
                            inp.getAttribute('wire:model.blur');
            if (wireModel === 'emailAddress') {
              emailInput = inp;
              break;
            }
          }
        }
        
        if (!emailInput) {
          var allInputs = document.querySelectorAll('input');
          for (var i = 0; i < allInputs.length; i++) {
            if (allInputs[i].type === 'text' || allInputs[i].type === 'email' || !allInputs[i].type) {
              emailInput = allInputs[i];
              break;
            }
          }
        }
        
        return emailInput;
      }
      
      function checkReady() {
        checkCount++;
        var emailInput = findEmailInput();
        
        if (emailInput) {
          console.log('[WebView] Page ready - input found after ' + checkCount + ' checks');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'page_loaded',
            url: window.location.href
          }));
        } else if (checkCount < maxChecks) {
          setTimeout(checkReady, 200);
        } else {
          console.log('[WebView] Giving up after ' + maxChecks + ' checks, sending ready anyway');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'page_loaded',
            url: window.location.href
          }));
        }
      }
      
      if (document.readyState === 'complete') {
        setTimeout(checkReady, 300);
      } else {
        window.addEventListener('load', function() {
          setTimeout(checkReady, 300);
        });
        setTimeout(checkReady, 2000);
      }

      document.addEventListener('livewire:navigated', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'navigated',
          url: window.location.href
        }));
      });

      var lastUrl = window.location.href;
      setInterval(function() {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'url_changed',
            url: window.location.href
          }));
        }
      }, 100);

      true;
    })();
  `;

  const fillAndSubmitForm = useCallback((emailToUse: string) => {
    if (!webViewRef.current || !emailToUse || hasSubmitted) {
      console.log('[LivewireWebView] Cannot submit - missing webview or email or already submitted');
      console.log('[LivewireWebView] webViewRef.current:', !!webViewRef.current);
      console.log('[LivewireWebView] emailToUse:', emailToUse);
      console.log('[LivewireWebView] hasSubmitted:', hasSubmitted);
      return;
    }

    const trimmedEmail = emailToUse.trim();
    console.log('[LivewireWebView] ========================================');
    console.log('[LivewireWebView] FILLING FORM WITH EMAIL:', trimmedEmail);
    console.log('[LivewireWebView] ========================================');
    setHasSubmitted(true);

    const safeEmail = trimmedEmail.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

    const submitScript = `
      (function() {
        try {
          var emailValue = '${safeEmail}';
          console.log('[WebView] Starting form fill with email:', emailValue);

          // Find the email input field - try multiple selectors
          var emailInput = null;
          
          // First try by wire:model attributes (Livewire specific)
          var allInputs = document.querySelectorAll('input');
          for (var i = 0; i < allInputs.length; i++) {
            var inp = allInputs[i];
            var wireModel = inp.getAttribute('wire:model') || 
                            inp.getAttribute('wire:model.live') || 
                            inp.getAttribute('wire:model.blur') ||
                            inp.getAttribute('wire:model.lazy') ||
                            inp.getAttribute('wire:model.debounce');
            if (wireModel && wireModel.toLowerCase().includes('email')) {
              emailInput = inp;
              console.log('[WebView] Found by wire:model:', wireModel);
              break;
            }
          }
          
          // Then try standard selectors
          if (!emailInput) {
            emailInput = document.querySelector('input[type="email"]') || 
                          document.querySelector('input[name="emailAddress"]') ||
                          document.querySelector('input[name="email"]') ||
                          document.querySelector('input[id*="email"]') ||
                          document.querySelector('input[placeholder*="email" i]');
          }
          
          // Last resort - first text/email input
          if (!emailInput) {
            for (var i = 0; i < allInputs.length; i++) {
              if (allInputs[i].type === 'text' || allInputs[i].type === 'email' || !allInputs[i].type) {
                emailInput = allInputs[i];
                break;
              }
            }
          }
          
          if (!emailInput) {
            console.log('[WebView] Email input NOT FOUND!');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'Email input not found'
            }));
            return;
          }

          console.log('[WebView] Found email input:', emailInput.tagName, 'name:', emailInput.name, 'type:', emailInput.type);
          console.log('[WebView] Current value:', emailInput.value);
          console.log('[WebView] Setting to:', emailValue);

          // Focus the input first
          emailInput.focus();
          
          // Use native value setter to bypass any framework protection
          var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(emailInput, emailValue);
          
          // Also set directly as fallback
          emailInput.value = emailValue;
          
          // Trigger all possible events for Livewire/Alpine.js
          var inputEvent = new Event('input', { bubbles: true, cancelable: true });
          emailInput.dispatchEvent(inputEvent);
          
          var changeEvent = new Event('change', { bubbles: true, cancelable: true });
          emailInput.dispatchEvent(changeEvent);
          
          // Trigger keydown/keyup for frameworks that listen to these
          emailInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
          emailInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
          emailInput.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'a' }));
          
          // Blur to trigger wire:model.blur
          emailInput.dispatchEvent(new Event('blur', { bubbles: true }));
          
          // For Alpine.js / Livewire 3 - trigger x-model update
          if (window.Alpine) {
            window.Alpine.nextTick(function() {
              console.log('[WebView] Alpine tick completed');
            });
          }

          console.log('[WebView] After setting - value is now:', emailInput.value);
          
          // Verify the email was set correctly
          if (emailInput.value !== emailValue) {
            console.log('[WebView] WARNING: Email value mismatch! Expected:', emailValue, 'Got:', emailInput.value);
            // Try setting again
            emailInput.value = emailValue;
          }

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'email_set',
            email: emailInput.value,
            expected: emailValue
          }));

          // Wait a moment for Livewire to process the input
          setTimeout(function() {
            // Verify email is still set before submitting
            console.log('[WebView] Pre-submit check - email value:', emailInput.value);
            
            if (emailInput.value !== emailValue) {
              console.log('[WebView] Re-setting email before submit');
              nativeInputValueSetter.call(emailInput, emailValue);
              emailInput.value = emailValue;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            console.log('[WebView] Looking for submit button...');
            // Find and click the submit button
            var submitButton = document.querySelector('button[type="submit"]') ||
                                document.querySelector('form button:not([type="button"])') ||
                                document.querySelector('button[wire\\:click]');
            
            // If not found, try to find by wire:click attribute manually
            if (!submitButton) {
              var allButtons = document.querySelectorAll('button');
              for (var j = 0; j < allButtons.length; j++) {
                var btn = allButtons[j];
                var wireClick = btn.getAttribute('wire:click');
                if (wireClick && (wireClick.includes('submit') || wireClick.includes('Submit'))) {
                  submitButton = btn;
                  break;
                }
              }
            }
            
            // Try any button that's not obviously a cancel/back button
            if (!submitButton) {
              var allButtons = document.querySelectorAll('button');
              for (var j = 0; j < allButtons.length; j++) {
                var btn = allButtons[j];
                var text = (btn.textContent || '').toLowerCase();
                if (!text.includes('cancel') && !text.includes('back') && !text.includes('close')) {
                  submitButton = btn;
                  break;
                }
              }
            }

            if (!submitButton) {
              console.log('[WebView] Submit button NOT FOUND!');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: 'Submit button not found'
              }));
              return;
            }

            console.log('[WebView] Found submit button:', submitButton.tagName, submitButton.textContent);
            console.log('[WebView] Final email value before click:', emailInput.value);

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'submitting',
              email: emailInput.value
            }));

            submitButton.click();
            console.log('[WebView] Submit button clicked!');

            // Check for errors after submission
            setTimeout(function() {
              var errorEl = document.querySelector('.text-red-500') ||
                             document.querySelector('.text-danger') ||
                             document.querySelector('[class*="error"]') ||
                             document.querySelector('.invalid-feedback');
              
              if (errorEl && errorEl.textContent.trim()) {
                console.log('[WebView] Validation error found:', errorEl.textContent.trim());
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'validation_error',
                  message: errorEl.textContent.trim()
                }));
              }
            }, 2000);

          }, 1000);

        } catch(e) {
          console.log('[WebView] ERROR:', e.message);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: e.message || 'Unknown error'
          }));
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(submitScript);
  }, [hasSubmitted]);

  useEffect(() => {
    if (trigger && isReady && !hasSubmitted && email) {
      console.log('[LivewireWebView] READY TO SUBMIT! Email:', email);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      const currentEmail = email;
      setTimeout(() => {
        fillAndSubmitForm(currentEmail);
      }, 500);
    }
  }, [trigger, isReady, hasSubmitted, email, fillAndSubmitForm]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[LivewireWebView] Message:', data.type, data.message || data.url || '');

      switch (data.type) {
        case 'page_loaded':
          console.log('[LivewireWebView] Page loaded:', data.url);
          setIsReady(true);
          break;

        case 'email_set':
          console.log('[LivewireWebView] Email set:', data.email);
          break;

        case 'submitting':
          console.log('[LivewireWebView] Form submitting...');
          break;

        case 'url_changed':
        case 'navigated':
          console.log('[LivewireWebView] Navigation:', data.url);
          const match = data.url.match(successPattern);
          if (match && match[1]) {
            console.log('[LivewireWebView] Success! Token:', match[1]);
            onSuccess(match[1]);
          }
          break;

        case 'validation_error':
          console.log('[LivewireWebView] Validation error:', data.message);
          onError(data.message);
          setHasSubmitted(false);
          break;

        case 'error':
          console.error('[LivewireWebView] Error:', data.message);
          onError(data.message);
          setHasSubmitted(false);
          break;

        case 'console':
          console.log('[LivewireWebView] Console:', data.message);
          break;
      }
    } catch {
      console.log('[LivewireWebView] Raw message:', event.nativeEvent.data);
    }
  }, [onSuccess, onError, successPattern]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    console.log('[LivewireWebView] Navigation state:', navState.url);
    
    const match = navState.url.match(successPattern);
    if (match && match[1]) {
      console.log('[LivewireWebView] Success from navigation! Token:', match[1]);
      onSuccess(match[1]);
    }
  }, [onSuccess, successPattern]);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[LivewireWebView] WebView error:', nativeEvent);
    onError(nativeEvent.description || 'Failed to load page');
  }, [onError]);

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: baseUrl }}
        style={styles.webview}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onError={handleError}
        onLoadEnd={() => {
          console.log('[LivewireWebView] WebView load ended');
          setTimeout(() => {
            if (!isReadyRef.current) {
              console.log('[LivewireWebView] Forcing ready state after load');
              setIsReady(true);
            }
          }, 2000);
        }}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={false}
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        cacheEnabled={false}
        incognito={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 400,
    height: 700,
    opacity: 0,
  },
  webview: {
    flex: 1,
    width: 400,
    height: 700,
  },
});
