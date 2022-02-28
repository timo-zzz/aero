package aero

import (
	_ "embed"
	"encoding/json"

	"strings"

	"github.com/buaazp/fasthttprouter"
	"github.com/dgrr/fastws"
	"github.com/dgrr/http2"
	"github.com/sirupsen/logrus"
	"github.com/valyala/fasthttp"
)

//go:embed index.js
var script string

// Aero represents an instance of the Aero proxy
type Aero struct {
	log    *logrus.Logger
	client *fasthttp.Client
	config Config
}

// New creates and starts a new Aero instance
func New(log *logrus.Logger, client *fasthttp.Client, config Config) (*Aero, error) {
	a := &Aero{log: log, client: client, config: config}

	r := fasthttprouter.New()
	r.GET(config.HTTP.Prefix+"*filepath", a.http)
	// Websocket support
	r.GET(config.WS.Prefix+"*filepath", a.ws)
	r.NotFound = fasthttp.FSHandler("./static", 0)

	srv := &fasthttp.Server{Handler: r.Handler}
	if config.SSL.Enabled {
		http2.ConfigureServer(srv)
		return a, srv.ListenAndServeTLS(config.HTTP.Addr, config.SSL.Cert, config.SSL.Key)
	}
	return a, srv.ListenAndServe(config.HTTP.Addr)
}

// http handles the HTTP proxy requests.
func (a *Aero) http(ctx *fasthttp.RequestCtx) {
	var query = ""
	var queryString = string(ctx.URI().QueryString())
	if queryString != "" {
		query = "?" + string(ctx.URI().QueryString())
	}
	url := strings.TrimPrefix(string(ctx.URI().PathOriginal())+query, a.config.HTTP.Prefix)

	a.log.Println(url)

	req := &fasthttp.Request{}
	req.SetRequestURI(url)

	rewrite := true
	ctx.Request.Header.VisitAll(func(k, v []byte) {
		switch string(k) {
		case "Accept-Encoding", "Cache-Control", "Sec-Gpc", "Sec-Fetch-Site", "Sec-Fetch-Mode", "Service-Worker":
			// Do nothing, so these headers aren't added
		case "Host":
			req.Header.SetBytesKV(k, req.Host())
		case "Referer":
			// Do this and post requests for discord and google would work
			//req.Header.SetBytesKV(k, ctx.Request.Header.Peek("_referrer"))
		case "_referer":
			req.Header.Set("Referer", string(v))
		case "Sec-Fetch-Dest":
			// Don't rewrite if the service worker is sending a navigate request
			if string(v) == "empty" {
				rewrite = false
			}
		default:
			req.Header.SetBytesKV(k, v)
		}
	})

	//a.log.Println(req.Header.String())

	var resp fasthttp.Response
	err := a.client.Do(req, &resp)
	if err != nil {
		a.log.Errorln(err)
		return
	}

	// The policy must be set
	ctx.Response.Header.Set("Access-Control-Allow-Origin", "*")

	delHeaders := make(map[string]string)
	resp.Header.VisitAll(func(k, v []byte) {
		sk := string(k)
		switch sk {
		case "Access-Control-Allow-Origin", "Alt-Svc", "Cache-Control", "Content-Encoding", "Content-Length", "Content-Security-Policy", "Cross-Origin-Resource-Policy", "Permissions-Policy", "Referrer-Policy", "Set-Cookie", "Set-Cookie2", "Service-Worker-Allowed", "Strict-Transport-Security", "Timing-Allow-Origin", "X-Frame-Options", "X-Xss-Protection":
			delHeaders[sk] = string(v)
		case "Location":
			a.log.Println("Location:" + string(v))
			ctx.Response.Header.SetBytesK(k, a.config.HTTP.Prefix+string(v))
		default:
			ctx.Response.Header.SetBytesKV(k, v)
		}
	})

	a.log.Println(ctx.Response.Header.String())

	ctx.Response.SetStatusCode(resp.StatusCode())

	body := resp.Body()
	cors, err := json.Marshal(delHeaders)
	if err != nil {
		a.log.Errorln(err)
		return
	}

	if rewrite {
		switch strings.Split(string(resp.Header.Peek("Content-Type")), ";")[0] {
		case "text/html", "text/x-html":
			body = []byte(`
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset=utf-8>

						<!--Reset favicon-->
						<link href=data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII= rel="icon" type="image/x-icon"/>
					</head>
					<body>
						<script type=module>
							'use strict';

							const ctx = {
								cors: ` + string(cors) + `,
								http: {
									prefix: '` + a.config.HTTP.Prefix + `'
								},
								ws: {
									prefix: '` + a.config.WS.Prefix + `'
								},
								url: '` + url + `'
							};

							` + string(script) + `
						</script>
					</body>
				</html>
			`)
		}
	}

	ctx.SetBody(body)
}

func (a *Aero) ws(ctx *fasthttp.RequestCtx) {
	url := strings.TrimPrefix(string(ctx.URI().PathOriginal()), a.config.WS.Prefix)

	fastws.Upgrade(func(conn *fastws.Conn) {
		a.log.Println(url)

		defer conn.Close()

		var msg []byte
		var err error

		cConn, err := fastws.Dial(url)
		if err != nil {
			a.log.Fatalln(err)
		}

		for {
			_, msg, err = conn.ReadMessage(msg[:0])
			if err != nil {
				break
			}
			a.log.Printf("Server: %s\n", msg)
			cConn.Write(msg)
		}

		for {
			_, cMsg, err := cConn.ReadMessage(msg[:0])
			if err != nil {
				break
			}
			a.log.Printf("Client: %s\n", msg)
			conn.Write(cMsg)
		}

		cConn.Close()
	})(ctx)
}
