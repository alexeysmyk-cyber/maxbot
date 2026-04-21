#!/bin/bash

echo "Updating project..."

git pull

npm install

pm2 restart all

echo "Done!"
