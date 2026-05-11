import React from 'react';

type ReconnectingEventSourceArgs<T> = {
  url: string | null;
  eventName: string;
  onMessage: (message: T) => void;
  reconnectMs?: number;
};

type ReconnectingEventSourcesArgs<T> = {
  urls: string[];
  eventName: string;
  onMessage: (message: T) => void;
  reconnectMs?: number;
};

const DEFAULT_RECONNECT_MS = 3_000;

export const useReconnectingEventSource = <T,>({
  url,
  eventName,
  onMessage,
  reconnectMs = DEFAULT_RECONNECT_MS,
}: ReconnectingEventSourceArgs<T>): void => {
  useReconnectingEventSources({
    urls: url ? [url] : [],
    eventName,
    onMessage,
    reconnectMs,
  });
};

export const useReconnectingEventSources = <T,>({
  urls,
  eventName,
  onMessage,
  reconnectMs = DEFAULT_RECONNECT_MS,
}: ReconnectingEventSourcesArgs<T>): void => {
  const onMessageRef = React.useRef(onMessage);
  const urlKey = urls.join('|');

  React.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  React.useEffect(() => {
    if (urls.length === 0) return undefined;

    let closed = false;
    const sources = new Map<string, EventSource>();
    const retryTimers = new Map<string, number>();

    const clearRetry = (url: string): void => {
      const retryTimer = retryTimers.get(url);
      if (retryTimer === undefined) return;
      window.clearTimeout(retryTimer);
      retryTimers.delete(url);
    };

    const connect = (url: string): void => {
      if (closed) return;
      sources.get(url)?.close();
      const nextSource = new EventSource(url);
      sources.set(url, nextSource);

      nextSource.addEventListener(eventName, (event) => {
        onMessageRef.current(JSON.parse((event as MessageEvent).data) as T);
      });

      nextSource.onerror = () => {
        nextSource.close();
        if (sources.get(url) === nextSource) sources.delete(url);
        if (closed || retryTimers.has(url)) return;
        const retryTimer = window.setTimeout(() => {
          retryTimers.delete(url);
          connect(url);
        }, reconnectMs);
        retryTimers.set(url, retryTimer);
      };
    };

    urls.forEach(connect);

    return () => {
      closed = true;
      urls.forEach(clearRetry);
      sources.forEach((source) => source.close());
      sources.clear();
    };
  }, [eventName, reconnectMs, urlKey]);
};
