const http = require('http')
const url = require('url')

const EventMaps = {
  connect: 'connecting',
  disconnect: 'closing',
  message: 'data send',
  default: 'default'
}

const isJson = (body) => {
  try {
    JSON.parse(body)
  } catch (e) {
    return false
  }
  return true
}

async function request(event, data = '') {
  const { websocket } = event
  const { action, secConnectionID, secWebSocketProtocol, secWebSocketExtensions } = websocket
  const retmsg = {
    websocket: {
      action: action,
      secConnectionID: secConnectionID,
      dataType: 'text',
      data: data
    }
  }
  if (secWebSocketProtocol) {
    retmsg.websocket.secWebSocketProtocol = secWebSocketProtocol
  }
  if (secWebSocketExtensions) {
    retmsg.websocket.secWebSocketExtensions = secWebSocketExtensions
  }

  const postData = JSON.stringify(retmsg)
  await new Promise((resolve) => {
    const urlObj = url.parse(process.env.wsBackUrl)
    const req = http.request(
      {
        method: 'POST',
        host: urlObj.host,
        path: urlObj.path,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        // console.log(`STATUS: ${res.statusCode}`);
        // console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          /* eslint-disable no-console */
          console.log(`BODY: ${chunk}`)
        })
        // res.on("end", () => {
        //   console.log("No more data in response.");
        // });
        resolve()
      }
    )

    req.on('error', (e) => {
      /* eslint-disable no-console */
      console.error(`problem with request: ${e.message}`)
    })

    // write data to request body
    req.write(postData)
    req.end()
  })
}

module.exports.socket = (event) => {
  const { websocket } = event
  const { secConnectionID, action, data } = websocket

  return new Promise((resolve) => {
    const exit = (returnValue = '') => {
      resolve({
        errNo: 0,
        errMsg: 'ok',
        data: returnValue,
        websocket: {
          action: action,
          secConnectionID: secConnectionID
        }
      })
    }

    const socket = {
      id: secConnectionID,
      event: event,
      send: async (sendData) => {
        return request(event, sendData)
      }
    }
    // we can make an exception for this single case
    // for the sake of UX
    global.on = async (route, fn) => {
      console.log('route', route)
      console.log('EventMaps', EventMaps)

      route = EventMaps[route]
      if (!route) {
        throw new Error(`Unknow event: ${route}`)
      }
      if (route === action) {
        if (action === 'data send') {
          if (isJson(data)) {
            const parsedData = JSON.parse(data)
            const response = await fn(parsedData, socket)
            exit(response)
          } else {
            const response = await fn(data, socket)
            exit(response)
          }
        } else {
          const response = await fn(null, socket)
          exit(response)
        }
      }
    }

    delete require.cache[require.resolve('./app')] // clear cache from previous require
    require('./app.js')
  })
}
